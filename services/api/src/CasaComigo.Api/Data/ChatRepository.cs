using CasaComigo.Api.Contracts;
using Npgsql;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class ChatRepository(NpgsqlDataSource dataSource) : IChatRepository
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<MessageResponse>> GetMessagesAsync(
        Guid profileId,
        Guid matchId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var conversationId = await GetConversationIdAsync(connection, profileId, matchId, cancellationToken);
        if (conversationId is null)
            throw new ChatNotFoundException();

        await using var command = connection.CreateCommand();
        command.CommandText = """
            select id, match_id, sender_id, body, created_at
            from (
                select id, sender_id, body, created_at, $2 as match_id
                from public.messages
                where conversation_id = $1
                order by created_at desc, id desc
                limit 100
            ) recent
            order by created_at, id
            """;
        command.Parameters.AddWithValue(conversationId.Value);
        command.Parameters.AddWithValue(matchId);

        var messages = new List<MessageResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            messages.Add(new MessageResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc))));
        }

        return messages;
    }

    /// <inheritdoc />
    public async Task<MessageResponse> SendMessageAsync(
        Guid profileId,
        Guid matchId,
        string body,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            insert into public.messages (conversation_id, sender_id, body)
            select c.id, $2, $3
            from public.conversations c
            join public.matches m on m.id = c.match_id
            where m.id = $1
              and $2 in (m.profile_a_id, m.profile_b_id)
              and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
              and not exists (
                  select 1 from public.housing_groups group_row
                  where group_row.origin_match_id = m.id
              )
            returning id, sender_id, body, created_at
            """;
        command.Parameters.AddWithValue(matchId);
        command.Parameters.AddWithValue(profileId);
        command.Parameters.AddWithValue(body);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new ChatNotFoundException();

        return new MessageResponse(
            reader.GetGuid(0),
            matchId,
            reader.GetGuid(1),
            reader.GetString(2),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(3), DateTimeKind.Utc)));
    }

    private static async Task<Guid?> GetConversationIdAsync(
        NpgsqlConnection connection,
        Guid profileId,
        Guid matchId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select c.id
            from public.conversations c
            join public.matches m on m.id = c.match_id
            where m.id = $1
              and $2 in (m.profile_a_id, m.profile_b_id)
              and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
              and not exists (
                  select 1 from public.housing_groups group_row
                  where group_row.origin_match_id = m.id
              )
            """;
        command.Parameters.AddWithValue(matchId);
        command.Parameters.AddWithValue(profileId);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is Guid conversationId ? conversationId : null;
    }
}
