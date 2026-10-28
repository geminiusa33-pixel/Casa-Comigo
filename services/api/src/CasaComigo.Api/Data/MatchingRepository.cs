using CasaComigo.Api.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class MatchingRepository(NpgsqlDataSource dataSource) : IMatchingRepository
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<DiscoveryProfileResponse>> GetDiscoverableAsync(
        Guid profileId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select p.id, p.display_name, p.bio, p.preferred_housemates,
                   p.gender_preference, p.has_pets, p.interests, p.opinions,
                   p.work_schedule, p.cooking_habits, p.monthly_budget,
                   p.lease_holder_preference, p.bills_preference, p.furnished_preference,
                   p.preferred_bathrooms, p.preferred_bedrooms, p.home_type_preference,
                   p.move_in_timing, p.minimum_lease_months,
                   photo.storage_object_path, sa.area_label
            from public.profiles p
            join public.search_areas sa on sa.profile_id = p.id
            left join lateral (
                select storage_object_path
                from public.profile_photos
                where profile_id = p.id
                order by display_order, created_at desc
                limit 1
            ) photo on true
            where p.id <> $1
              and p.discovery_visible
              and public.is_area_compatible($1, p.id)
              and not exists (
                  select 1 from public.likes l
                  where l.actor_id = $1 and l.recipient_id = p.id
              )
              and not exists (
                  select 1 from public.profile_passes pp
                  where pp.actor_id = $1
                    and pp.recipient_id = p.id
                    and pp.passed_at > now() - interval '3 days'
              )
            order by p.updated_at desc, p.id
            limit 50
            """;
        command.Parameters.AddWithValue(profileId);

        var profiles = new List<DiscoveryProfileResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            profiles.Add(new DiscoveryProfileResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetInt16(3),
                reader.GetString(4),
                reader.GetBoolean(5),
                reader.GetFieldValue<string[]>(6),
                reader.GetString(7),
                reader.GetString(8),
                reader.GetString(9),
                reader.IsDBNull(10) ? null : reader.GetDecimal(10),
                reader.GetString(11),
                reader.GetString(12),
                reader.GetString(13),
                reader.IsDBNull(14) ? null : reader.GetInt16(14),
                reader.IsDBNull(15) ? null : reader.GetInt16(15),
                reader.GetString(16),
                reader.GetString(17),
                reader.IsDBNull(18) ? null : reader.GetInt16(18),
                reader.IsDBNull(19) ? null : reader.GetString(19),
                reader.GetString(20)));
        }

        return profiles;
    }

    /// <inheritdoc />
    public async Task<LikeResponse> LikeAsync(
        Guid profileId,
        Guid recipientId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var claimCommand = connection.CreateCommand())
        {
            claimCommand.Transaction = transaction;
            claimCommand.CommandText = "select set_config('request.jwt.claim.sub', $1, true)";
            claimCommand.Parameters.AddWithValue(profileId.ToString());
            await claimCommand.ExecuteScalarAsync(cancellationToken);
        }

        await using var likeCommand = connection.CreateCommand();
        likeCommand.Transaction = transaction;
        likeCommand.CommandText = "select public.record_like($1)";
        likeCommand.Parameters.AddWithValue(NpgsqlDbType.Uuid, recipientId);
        try
        {
            var result = await likeCommand.ExecuteScalarAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result is null or DBNull
                ? new LikeResponse(true, false, null)
                : new LikeResponse(true, true, (Guid)result);
        }
        catch (PostgresException exception) when (exception.SqlState == "42501")
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ProfileValidationException("Este perfil já não está disponível na sua zona de procura.");
        }
    }

    /// <inheritdoc />
    public async Task<bool> PassAsync(
        Guid profileId,
        Guid recipientId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var claimCommand = connection.CreateCommand())
        {
            claimCommand.Transaction = transaction;
            claimCommand.CommandText = "select set_config('request.jwt.claim.sub', $1, true)";
            claimCommand.Parameters.AddWithValue(profileId.ToString());
            await claimCommand.ExecuteScalarAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select public.record_pass($1)";
        command.Parameters.AddWithValue(NpgsqlDbType.Uuid, recipientId);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result is true;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<MatchResponse>> GetMatchesAsync(
        Guid profileId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select m.id, other.id, other.display_name, other.bio,
                   other.preferred_housemates, other.gender_preference,
                   other.has_pets, other.interests, other.opinions,
                   other.work_schedule, other.cooking_habits,
                   coalesce(sa.area_label, ''), m.created_at,
                   other.monthly_budget, other.lease_holder_preference,
                   other.bills_preference, other.furnished_preference,
                   other.preferred_bathrooms, other.preferred_bedrooms,
                   other.home_type_preference, other.move_in_timing,
                   other.minimum_lease_months, photo.storage_object_path
            from public.matches m
            join public.profiles other on other.id =
                case when m.profile_a_id = $1 then m.profile_b_id else m.profile_a_id end
            left join public.search_areas sa on sa.profile_id = other.id
            left join lateral (
                select storage_object_path
                from public.profile_photos
                where profile_id = other.id
                order by display_order, created_at desc
                limit 1
            ) photo on true
            where $1 in (m.profile_a_id, m.profile_b_id)
              and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
            order by m.created_at desc
            """;
        command.Parameters.AddWithValue(profileId);

        var matches = new List<MatchResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            matches.Add(new MatchResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetInt16(4),
                reader.GetString(5),
                reader.GetBoolean(6),
                reader.GetFieldValue<string[]>(7),
                reader.GetString(8),
                reader.GetString(9),
                reader.GetString(10),
                reader.GetString(11),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(12), DateTimeKind.Utc)),
                reader.IsDBNull(13) ? null : reader.GetDecimal(13),
                reader.GetString(14),
                reader.GetString(15),
                reader.GetString(16),
                reader.IsDBNull(17) ? null : reader.GetInt16(17),
                reader.IsDBNull(18) ? null : reader.GetInt16(18),
                reader.GetString(19),
                reader.GetString(20),
                reader.IsDBNull(21) ? null : reader.GetInt16(21),
                reader.IsDBNull(22) ? null : reader.GetString(22)));
        }

        return matches;
    }

    /// <inheritdoc />
    public async Task<bool> CancelMatchAsync(
        Guid profileId,
        Guid matchId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var claimCommand = connection.CreateCommand())
        {
            claimCommand.Transaction = transaction;
            claimCommand.CommandText = "select set_config('request.jwt.claim.sub', $1, true)";
            claimCommand.Parameters.AddWithValue(profileId.ToString());
            await claimCommand.ExecuteScalarAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select public.cancel_match($1)";
        command.Parameters.AddWithValue(matchId);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result is true;
    }
}
