using CasaComigo.Api.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class HousingGroupRepository(NpgsqlDataSource dataSource) : IHousingGroupRepository
{
    /// <inheritdoc />
    public Task<IReadOnlyList<HousingGroupResponse>> GetMyGroupsAsync(Guid profileId, CancellationToken cancellationToken) =>
        GetGroupsAsync(profileId, discoverable: false, cancellationToken);

    /// <inheritdoc />
    public Task<IReadOnlyList<HousingGroupResponse>> GetDiscoverableGroupsAsync(Guid profileId, CancellationToken cancellationToken) =>
        GetGroupsAsync(profileId, discoverable: true, cancellationToken);

    /// <inheritdoc />
    public async Task<bool> RenameAsync(Guid profileId, Guid groupId, string name, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await SetActorAsync(connection, transaction, profileId, cancellationToken);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            update public.housing_groups group_row
            set group_name = $3
            where group_row.id = $1
              and exists (
                  select 1 from public.housing_group_members member
                  where member.group_id = group_row.id and member.profile_id = $2
              )
            """;
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);
        command.Parameters.AddWithValue(NpgsqlDbType.Text, name);
        var updated = await command.ExecuteNonQueryAsync(cancellationToken) == 1;
        await transaction.CommitAsync(cancellationToken);
        return updated;
    }

    /// <inheritdoc />
    public async Task<bool> LeaveAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var lockCommand = connection.CreateCommand())
        {
            lockCommand.Transaction = transaction;
            lockCommand.CommandText = """
                select group_row.id
                from public.housing_groups group_row
                where group_row.id = $1
                  and exists (
                      select 1 from public.housing_group_members member
                      where member.group_id = group_row.id and member.profile_id = $2
                  )
                for update
                """;
            lockCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
            lockCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);
            if (await lockCommand.ExecuteScalarAsync(cancellationToken) is not Guid)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }
        }

        await ExecuteGroupMemberChangeAsync(
            connection,
            transaction,
            """
            delete from public.housing_group_join_votes vote
            using public.housing_group_join_requests request
            where vote.request_id = request.id
              and request.group_id = $1
              and vote.voter_id = $2
            """,
            groupId,
            profileId,
            cancellationToken);
        await ExecuteGroupMemberChangeAsync(
            connection,
            transaction,
            "delete from public.housing_group_completion_votes where group_id = $1 and profile_id = $2",
            groupId,
            profileId,
            cancellationToken);
        await ExecuteGroupMemberChangeAsync(
            connection,
            transaction,
            "delete from public.housing_group_members where group_id = $1 and profile_id = $2",
            groupId,
            profileId,
            cancellationToken);
        await using (var closeCommand = connection.CreateCommand())
        {
            closeCommand.Transaction = transaction;
            closeCommand.CommandText = """
                update public.housing_groups group_row
                set status = 'completed', completed_at = coalesce(group_row.completed_at, now())
                where group_row.id = $1
                  and group_row.status = 'open'
                  and not exists (
                      select 1 from public.housing_group_members member
                      where member.group_id = group_row.id
                  )
                """;
            closeCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
            await closeCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    private static async Task ExecuteGroupMemberChangeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        Guid groupId,
        Guid profileId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Guid> RequestJoinAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await SetActorAsync(connection, transaction, profileId, cancellationToken);

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select public.request_housing_group_join($1)";
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        if (result is not Guid requestId)
            throw new ProfileValidationException("Este grupo já não está disponível ou a lotação e a zona de procura não são compatíveis.");
        return requestId;
    }

    /// <inheritdoc />
    public async Task<string> VoteJoinRequestAsync(
        Guid profileId,
        Guid requestId,
        bool accept,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await SetActorAsync(connection, transaction, profileId, cancellationToken);

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select public.vote_housing_group_join($1, $2)";
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, requestId);
        command.Parameters.AddWithValue(NpgsqlDbType.Boolean, accept);
        var result = (string?)await command.ExecuteScalarAsync(cancellationToken) ?? "unavailable";
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    /// <inheritdoc />
    public async Task<bool> ConfirmCompletionAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await SetActorAsync(connection, transaction, profileId, cancellationToken);

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select public.confirm_housing_group_completion($1)";
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result is true;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<HousingGroupMessageResponse>> GetMessagesAsync(
        Guid profileId,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using (var accessCommand = connection.CreateCommand())
        {
            accessCommand.CommandText = """
                select exists (
                    select 1 from public.housing_group_members own_member
                    where own_member.group_id = $1 and own_member.profile_id = $2
                )
                and not exists (
                    select 1 from public.housing_group_members member
                    where member.group_id = $1 and member.profile_id <> $2
                      and public.is_blocked_user($2, member.profile_id)
                )
                """;
            accessCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
            accessCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);
            if (await accessCommand.ExecuteScalarAsync(cancellationToken) is not true)
                throw new ChatNotFoundException();
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            select message.id, message.group_id, message.sender_id, message.body, message.created_at
            from public.housing_group_messages message
            where message.group_id = $1
              and exists (
                  select 1 from public.housing_group_members member
                  where member.group_id = message.group_id and member.profile_id = $2
              )
              and not exists (
                  select 1 from public.housing_group_members member
                  where member.group_id = message.group_id
                    and member.profile_id <> $2
                    and public.is_blocked_user($2, member.profile_id)
              )
            order by message.created_at desc, message.id desc
            limit 100
            """;
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);

        var messages = new List<HousingGroupMessageResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            messages.Add(ReadMessage(reader));
        messages.Reverse();
        return messages;
    }

    /// <inheritdoc />
    public async Task<HousingGroupMessageResponse> SendMessageAsync(
        Guid profileId,
        Guid groupId,
        string body,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await SetActorAsync(connection, transaction, profileId, cancellationToken);

        Guid? messageId;
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "select public.send_housing_group_message($1, $2)";
            command.Parameters.AddWithValue(NpgsqlDbType.Uuid, groupId);
            command.Parameters.AddWithValue(NpgsqlDbType.Text, body);
            var result = await command.ExecuteScalarAsync(cancellationToken);
            messageId = result is Guid id ? id : null;
        }

        if (messageId is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ChatNotFoundException();
        }

        await using var readCommand = connection.CreateCommand();
        readCommand.Transaction = transaction;
        readCommand.CommandText = """
            select id, group_id, sender_id, body, created_at
            from public.housing_group_messages
            where id = $1
            """;
        readCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, messageId.Value);
        await using var reader = await readCommand.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("A mensagem criada não foi encontrada.");

        var message = ReadMessage(reader);
        await reader.CloseAsync();
        await transaction.CommitAsync(cancellationToken);
        return message;
    }

    private async Task<IReadOnlyList<HousingGroupResponse>> GetGroupsAsync(
        Guid profileId,
        bool discoverable,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = discoverable
            ? """
              select group_row.id, group_row.origin_match_id, group_row.group_name,
                     group_row.target_occupants, group_row.status, group_row.created_at,
                     (select count(*)::integer from public.housing_group_completion_votes vote
                      where vote.group_id = group_row.id) as completion_confirmations,
                     latest_request.status as my_request_status
              from public.housing_groups group_row
              left join lateral (
                  select request.status
                  from public.housing_group_join_requests request
                  where request.group_id = group_row.id and request.requester_id = $1
                  order by request.created_at desc
                  limit 1
              ) latest_request on true
              where group_row.status = 'open'
                and group_row.target_occupants = (
                    select preferred_housemates from public.profiles where id = $1
                )
                and (
                    select rent_contribution_range from public.profiles where id = $1
                ) is not null
                and not exists (
                    select 1 from public.housing_group_members own_member
                    where own_member.group_id = group_row.id and own_member.profile_id = $1
                )
                and not exists (
                    select 1
                    from public.housing_group_members member
                    join public.profiles group_profile on group_profile.id = member.profile_id
                    where member.group_id = group_row.id
                      and (not group_profile.discovery_visible
                           or public.is_blocked_user($1, member.profile_id))
                )
                and exists (
                    select 1 from public.housing_group_members member
                    where member.group_id = group_row.id
                      and public.is_area_compatible($1, member.profile_id)
                      and public.is_area_compatible(member.profile_id, $1)
                )
                and not exists (
                    select 1 from public.housing_group_members member
                    where member.group_id = group_row.id
                      and (not public.is_area_compatible($1, member.profile_id)
                           or not public.is_area_compatible(member.profile_id, $1))
                )
                and not exists (
                    select 1
                    from public.housing_group_members member
                    join public.profiles group_profile on group_profile.id = member.profile_id
                    where member.group_id = group_row.id
                      and group_profile.rent_contribution_range is distinct from (
                          select rent_contribution_range from public.profiles where id = $1
                      )
                )
                and (select count(*) from public.housing_group_members member
                     where member.group_id = group_row.id) < group_row.target_occupants
              order by group_row.created_at desc
              limit 50
              """
            : """
              select group_row.id, group_row.origin_match_id, group_row.group_name,
                     group_row.target_occupants, group_row.status, group_row.created_at,
                     (select count(*)::integer from public.housing_group_completion_votes vote
                      join public.housing_group_members member
                        on member.group_id = vote.group_id and member.profile_id = vote.profile_id
                      where vote.group_id = group_row.id) as completion_confirmations,
                     null::text as my_request_status
              from public.housing_groups group_row
              where exists (
                  select 1 from public.housing_group_members member
                  where member.group_id = group_row.id and member.profile_id = $1
              )
                and not exists (
                    select 1 from public.housing_group_members member
                    where member.group_id = group_row.id and member.profile_id <> $1
                      and public.is_blocked_user($1, member.profile_id)
                )
              order by group_row.created_at desc
              limit 50
              """;
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);

        var groups = new List<GroupRow>();
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
                groups.Add(new GroupRow(
                    reader.GetGuid(0),
                    reader.IsDBNull(1) ? null : reader.GetGuid(1),
                    reader.GetString(2),
                    reader.GetInt16(3),
                    reader.GetString(4),
                    AsUtc(reader.GetDateTime(5)),
                    reader.GetInt32(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7)));
        }

        if (groups.Count == 0)
            return [];

        var groupIds = groups.Select(group => group.Id).ToArray();
        var membersByGroup = await GetMembersAsync(connection, groupIds, cancellationToken);
        var requestsByGroup = discoverable
            ? new Dictionary<Guid, List<HousingGroupJoinRequestResponse>>()
            : await GetPendingRequestsAsync(connection, groupIds, profileId, cancellationToken);

        return groups.Select(group =>
        {
            var members = membersByGroup.GetValueOrDefault(group.Id) ?? [];
            var requests = requestsByGroup.GetValueOrDefault(group.Id) ?? [];
            var totalRentRange = RentContributionRanges.Sum(members.Select(member => member.RentContributionRange));
            return new HousingGroupResponse(
                group.Id,
                group.OriginMatchId,
                group.Name,
                group.TargetOccupants,
                members.Count,
                totalRentRange?.Minimum,
                totalRentRange?.Maximum,
                group.CompletionConfirmations,
                group.Status,
                group.CreatedAt,
                group.MyRequestStatus,
                members,
                requests);
        }).ToArray();
    }

    private static async Task<Dictionary<Guid, List<HousingGroupMemberResponse>>> GetMembersAsync(
        NpgsqlConnection connection,
        Guid[] groupIds,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select member.group_id, member.profile_id, profile.display_name, photo.storage_object_path,
                   coalesce(area.area_label, ''), profile.rent_contribution_range,
                   exists (
                       select 1 from public.housing_group_completion_votes vote
                       where vote.group_id = member.group_id and vote.profile_id = member.profile_id
                   ),
                   profile.bio, profile.preferred_housemates, profile.gender_preference,
                   profile.has_pets, profile.interests, profile.opinions, profile.work_schedule,
                   profile.cooking_habits, profile.rent_contribution_range,
                   profile.lease_holder_preference, profile.bills_preference,
                   profile.furnished_preference, profile.preferred_bathrooms, profile.preferred_bedrooms,
                   profile.home_type_preference, profile.move_in_timing, profile.minimum_lease_months
            from public.housing_group_members member
            join public.profiles profile on profile.id = member.profile_id
            left join public.search_areas area on area.profile_id = profile.id
            left join lateral (
                select storage_object_path from public.profile_photos
                where profile_id = profile.id
                order by display_order, created_at desc
                limit 1
            ) photo on true
            where member.group_id = any($1)
            order by member.joined_at, profile.display_name
            """;
        command.Parameters.AddWithValue(NpgsqlDbType.Array | NpgsqlDbType.Uuid, groupIds);

        var members = new Dictionary<Guid, List<HousingGroupMemberResponse>>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var groupId = reader.GetGuid(0);
            if (!members.TryGetValue(groupId, out var groupMembers))
                members[groupId] = groupMembers = [];
            groupMembers.Add(new HousingGroupMemberResponse(
                reader.GetGuid(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.GetBoolean(6),
                ReadProfile(reader, 7)));
        }

        return members;
    }

    private static async Task<Dictionary<Guid, List<HousingGroupJoinRequestResponse>>> GetPendingRequestsAsync(
        NpgsqlConnection connection,
        Guid[] groupIds,
        Guid profileId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select request.group_id, request.id, requester.id, requester.display_name,
                   photo.storage_object_path, coalesce(area.area_label, ''), requester.rent_contribution_range,
                   (select count(*)::integer from public.housing_group_join_votes vote
                    join public.housing_group_members member
                      on member.group_id = request.group_id and member.profile_id = vote.voter_id
                    where vote.request_id = request.id and vote.accepted),
                   (select count(*)::integer from public.housing_group_members member
                    where member.group_id = request.group_id),
                   (select vote.accepted from public.housing_group_join_votes vote
                    where vote.request_id = request.id and vote.voter_id = $2),
                   request.created_at,
                   requester.bio, requester.preferred_housemates, requester.gender_preference,
                   requester.has_pets, requester.interests, requester.opinions, requester.work_schedule,
                   requester.cooking_habits, requester.rent_contribution_range,
                   requester.lease_holder_preference, requester.bills_preference,
                   requester.furnished_preference, requester.preferred_bathrooms, requester.preferred_bedrooms,
                   requester.home_type_preference, requester.move_in_timing, requester.minimum_lease_months
            from public.housing_group_join_requests request
            join public.profiles requester on requester.id = request.requester_id
            left join public.search_areas area on area.profile_id = requester.id
            left join lateral (
                select storage_object_path from public.profile_photos
                where profile_id = requester.id
                order by display_order, created_at desc
                limit 1
            ) photo on true
            where request.group_id = any($1)
              and request.status = 'pending'
              and not exists (
                  select 1 from public.housing_group_members member
                  where member.group_id = request.group_id
                    and public.is_blocked_user(member.profile_id, requester.id)
              )
            order by request.created_at
            """;
        command.Parameters.AddWithValue(NpgsqlDbType.Array | NpgsqlDbType.Uuid, groupIds);
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, profileId);

        var requests = new Dictionary<Guid, List<HousingGroupJoinRequestResponse>>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var groupId = reader.GetGuid(0);
            if (!requests.TryGetValue(groupId, out var groupRequests))
                requests[groupId] = groupRequests = [];
            groupRequests.Add(new HousingGroupJoinRequestResponse(
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.GetInt32(7),
                reader.GetInt32(8),
                reader.IsDBNull(9) ? null : reader.GetBoolean(9),
                AsUtc(reader.GetDateTime(10)),
                ReadProfile(reader, 11)));
        }

        return requests;
    }

    private static async Task SetActorAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid profileId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select set_config('request.jwt.claim.sub', $1, true)";
        command.Parameters.AddWithValue(NpgsqlDbType.Text, profileId.ToString());
        await command.ExecuteScalarAsync(cancellationToken);
    }

    private static HousingGroupMessageResponse ReadMessage(NpgsqlDataReader reader) =>
        new(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), AsUtc(reader.GetDateTime(4)));

    private static HousingGroupProfileResponse ReadProfile(NpgsqlDataReader reader, int index) =>
        new(
            reader.GetString(index),
            reader.IsDBNull(index + 1) ? null : reader.GetInt16(index + 1),
            reader.GetString(index + 2),
            reader.GetBoolean(index + 3),
            reader.GetFieldValue<string[]>(index + 4),
            reader.GetString(index + 5),
            reader.GetString(index + 6),
            reader.GetString(index + 7),
            reader.IsDBNull(index + 8) ? null : reader.GetString(index + 8),
            reader.GetString(index + 9),
            reader.GetString(index + 10),
            reader.GetString(index + 11),
            reader.IsDBNull(index + 12) ? null : reader.GetInt16(index + 12),
            reader.IsDBNull(index + 13) ? null : reader.GetInt16(index + 13),
            reader.GetString(index + 14),
            reader.GetString(index + 15),
            reader.IsDBNull(index + 16) ? null : reader.GetInt16(index + 16));

    private static DateTimeOffset AsUtc(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private sealed record GroupRow(
        Guid Id,
        Guid? OriginMatchId,
        string Name,
        short TargetOccupants,
        string Status,
        DateTimeOffset CreatedAt,
        int CompletionConfirmations,
        string? MyRequestStatus);
}
