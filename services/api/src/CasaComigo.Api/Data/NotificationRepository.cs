using CasaComigo.Api.Contracts;
using Npgsql;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class NotificationRepository(NpgsqlDataSource dataSource) : INotificationRepository
{
    /// <inheritdoc />
    public async Task<NotificationListResponse> GetAsync(Guid profileId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var countCommand = connection.CreateCommand();
        countCommand.CommandText = """
            select count(*)::integer
            from public.notifications
            where profile_id = $1 and read_at is null
            """;
        countCommand.Parameters.AddWithValue(profileId);
        var unreadCount = (int)(await countCommand.ExecuteScalarAsync(cancellationToken)
            ?? throw new InvalidOperationException("Não foi possível contar as notificações não lidas."));

        await using var command = connection.CreateCommand();
        command.CommandText = """
            select id, notification_type, title, body, resource_type, resource_id, created_at, read_at
            from public.notifications
            where profile_id = $1
            order by created_at desc, id desc
            limit 50
            """;
        command.Parameters.AddWithValue(profileId);

        var notifications = new List<NotificationResponse>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            notifications.Add(new NotificationResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetGuid(5),
                AsUtc(reader.GetDateTime(6)),
                reader.IsDBNull(7) ? null : AsUtc(reader.GetDateTime(7))));
        }

        return new NotificationListResponse(notifications, unreadCount);
    }

    /// <inheritdoc />
    public async Task<bool> MarkReadAsync(Guid profileId, Guid notificationId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            update public.notifications
            set read_at = coalesce(read_at, now())
            where id = $1 and profile_id = $2
            """;
        command.Parameters.AddWithValue(notificationId);
        command.Parameters.AddWithValue(profileId);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    /// <inheritdoc />
    public async Task MarkAllReadAsync(Guid profileId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            update public.notifications
            set read_at = now()
            where profile_id = $1 and read_at is null
            """;
        command.Parameters.AddWithValue(profileId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task SavePushSubscriptionAsync(
        Guid profileId,
        SavePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(request.Endpoint, UriKind.Absolute, out var endpoint)
            || endpoint.Scheme != Uri.UriSchemeHttps
            || !endpoint.IsDefaultPort
            || !string.IsNullOrEmpty(endpoint.UserInfo)
            || endpoint.Host is not (
                "fcm.googleapis.com"
                or "updates.push.services.mozilla.com"
                or "web.push.apple.com"))
            throw new ProfileValidationException("O endpoint não pertence a um serviço push de browser suportado.");

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            insert into public.notification_push_subscriptions (profile_id, endpoint, p256dh, auth)
            values ($1, $2, $3, $4)
            on conflict (endpoint) do update set
                profile_id = excluded.profile_id,
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                updated_at = now()
            """;
        command.Parameters.AddWithValue(profileId);
        command.Parameters.AddWithValue(request.Endpoint);
        command.Parameters.AddWithValue(request.P256dh);
        command.Parameters.AddWithValue(request.Auth);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task DeletePushSubscriptionAsync(
        Guid profileId,
        string endpoint,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            delete from public.notification_push_subscriptions
            where profile_id = $1 and endpoint = $2
            """;
        command.Parameters.AddWithValue(profileId);
        command.Parameters.AddWithValue(endpoint);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static DateTimeOffset AsUtc(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
