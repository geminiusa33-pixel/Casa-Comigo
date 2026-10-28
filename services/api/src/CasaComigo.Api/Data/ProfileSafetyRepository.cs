using CasaComigo.Api.Contracts;
using Npgsql;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class ProfileSafetyRepository(NpgsqlDataSource dataSource) : IProfileSafetyRepository
{
    /// <inheritdoc />
    public async Task BlockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            insert into public.profile_blocks (blocker_id, blocked_id)
            select $1, p.id
            from public.profiles p
            where p.id = $2
            on conflict (blocker_id, blocked_id) do nothing
            """;
        command.Parameters.AddWithValue(blockerId);
        command.Parameters.AddWithValue(blockedId);

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        if (affected == 0)
        {
            await using var existsCommand = connection.CreateCommand();
            existsCommand.CommandText = "select exists (select 1 from public.profiles where id = $1)";
            existsCommand.Parameters.AddWithValue(blockedId);
            if (await existsCommand.ExecuteScalarAsync(cancellationToken) is not true)
                throw new ProfileSafetyNotFoundException();
        }
    }

    /// <inheritdoc />
    public async Task UnblockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            delete from public.profile_blocks
            where blocker_id = $1 and blocked_id = $2
            """;
        command.Parameters.AddWithValue(blockerId);
        command.Parameters.AddWithValue(blockedId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<BlockedProfileResponse>> GetBlockedProfilesAsync(
        Guid blockerId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select p.id, p.display_name, b.created_at
            from public.profile_blocks b
            join public.profiles p on p.id = b.blocked_id
            where b.blocker_id = $1
            order by b.created_at desc, p.id
            """;
        command.Parameters.AddWithValue(blockerId);

        var profiles = new List<BlockedProfileResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            profiles.Add(new BlockedProfileResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(2), DateTimeKind.Utc))));
        }

        return profiles;
    }

    /// <inheritdoc />
    public async Task<ProfileReportResponse> ReportAsync(
        Guid reporterId,
        Guid reportedId,
        string reason,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var lockCommand = connection.CreateCommand())
        {
            lockCommand.Transaction = transaction;
            lockCommand.CommandText = """
                select pg_advisory_xact_lock(
                    pg_catalog.hashtextextended($1::text || ':' || $2::text, 0)
                )
                """;
            lockCommand.Parameters.AddWithValue(reporterId);
            lockCommand.Parameters.AddWithValue(reportedId);
            await lockCommand.ExecuteScalarAsync(cancellationToken);
        }

        await using (var targetCommand = connection.CreateCommand())
        {
            targetCommand.Transaction = transaction;
            targetCommand.CommandText = "select exists (select 1 from public.profiles where id = $1)";
            targetCommand.Parameters.AddWithValue(reportedId);
            if (await targetCommand.ExecuteScalarAsync(cancellationToken) is not true)
                throw new ProfileSafetyNotFoundException();
        }

        await using (var cooldownCommand = connection.CreateCommand())
        {
            cooldownCommand.Transaction = transaction;
            cooldownCommand.CommandText = """
                select exists (
                    select 1 from public.profile_reports
                    where reporter_id = $1 and reported_id = $2
                      and created_at > now() - interval '10 minutes'
                )
                """;
            cooldownCommand.Parameters.AddWithValue(reporterId);
            cooldownCommand.Parameters.AddWithValue(reportedId);
            if (await cooldownCommand.ExecuteScalarAsync(cancellationToken) is true)
                throw new ProfileSafetyConflictException(
                    "Já enviou uma denúncia sobre este perfil. Aguarde dez minutos antes de enviar outra.");
        }

        await using var insertCommand = connection.CreateCommand();
        insertCommand.Transaction = transaction;
        insertCommand.CommandText = """
            insert into public.profile_reports (reporter_id, reported_id, reason)
            values ($1, $2, $3)
            returning id, created_at
            """;
        insertCommand.Parameters.AddWithValue(reporterId);
        insertCommand.Parameters.AddWithValue(reportedId);
        insertCommand.Parameters.AddWithValue(reason);
        await using var reader = await insertCommand.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        var report = new ProfileReportResponse(
            reader.GetGuid(0),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(1), DateTimeKind.Utc)));
        await reader.CloseAsync();
        await transaction.CommitAsync(cancellationToken);
        return report;
    }
}
