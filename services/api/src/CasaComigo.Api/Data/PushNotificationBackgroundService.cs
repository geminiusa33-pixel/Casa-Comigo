using System.Net;
using System.Net.Http;
using System.Text.Json;
using WebPush;

namespace CasaComigo.Api.Data;

/// <summary>Sends persisted notification events to browser push services.</summary>
public sealed class PushNotificationBackgroundService(
    Npgsql.NpgsqlDataSource dataSource,
    IConfiguration configuration,
    ILogger<PushNotificationBackgroundService> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var publicKey = configuration["WebPush:VapidPublicKey"];
        var privateKey = configuration["WebPush:VapidPrivateKey"];
        var subject = configuration["WebPush:VapidSubject"];
        if (string.IsNullOrWhiteSpace(publicKey)
            || string.IsNullOrWhiteSpace(privateKey)
            || string.IsNullOrWhiteSpace(subject))
        {
            logger.LogInformation("Browser push is disabled; VAPID settings are not configured.");
            return;
        }

        var vapidDetails = new VapidDetails(subject, publicKey, privateKey);
        using var client = new WebPushClient();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var delivered = await DispatchPendingAsync(client, vapidDetails, stoppingToken);
                if (delivered == 0)
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Npgsql.NpgsqlException exception)
            {
                logger.LogError(exception, "Could not read pending browser notifications.");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private async Task<int> DispatchPendingAsync(
        WebPushClient client,
        VapidDetails vapidDetails,
        CancellationToken cancellationToken)
    {
        var dispatched = 0;
        for (var index = 0; index < 50; index++)
        {
            var notification = await ClaimNextAsync(cancellationToken);
            if (notification is null)
                return dispatched;

            var subscriptions = await GetSubscriptionsAsync(notification.ProfileId, cancellationToken);
            var payload = JsonSerializer.Serialize(new
            {
                title = notification.Title,
                body = notification.Body,
                resourceType = notification.ResourceType,
                resourceId = notification.ResourceId
            }, JsonOptions);

            foreach (var subscription in subscriptions)
            {
                try
                {
                    await client.SendNotificationAsync(
                        new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth),
                        payload,
                        vapidDetails,
                        cancellationToken);
                }
                catch (WebPushException exception) when (
                    exception.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
                {
                    logger.LogInformation("Removing expired browser push subscription for user {ProfileId}.", notification.ProfileId);
                    await RemoveSubscriptionAsync(subscription.Endpoint, cancellationToken);
                }
                catch (WebPushException exception)
                {
                    logger.LogWarning(
                        exception,
                        "Push service rejected notification {NotificationId} with status {StatusCode}.",
                        notification.Id,
                        exception.StatusCode);
                }
                catch (HttpRequestException exception)
                {
                    logger.LogWarning(exception, "Push service could not be reached for notification {NotificationId}.", notification.Id);
                }
            }

            dispatched++;
        }

        return dispatched;
    }

    private async Task<PendingNotification?> ClaimNextAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            update public.notifications notification
            set push_sent_at = now()
            where notification.push_sent_at is null
              and not exists (
                  select 1
                  from public.notification_push_subscriptions subscription
                  where subscription.profile_id = notification.profile_id
                    and subscription.created_at <= notification.created_at
              )
            """;
        await command.ExecuteNonQueryAsync(cancellationToken);

        await using var claimCommand = connection.CreateCommand();
        claimCommand.Transaction = transaction;
        claimCommand.CommandText = """
            with next_notification as (
                select notification.id
                from public.notifications notification
                where notification.push_sent_at is null
                  and exists (
                      select 1
                      from public.notification_push_subscriptions subscription
                      where subscription.profile_id = notification.profile_id
                        and subscription.created_at <= notification.created_at
                  )
                order by notification.created_at, notification.id
                for update skip locked
                limit 1
            )
            update public.notifications notification
            set push_sent_at = now()
            from next_notification
            where notification.id = next_notification.id
            returning notification.id, notification.profile_id, notification.title,
                      notification.body, notification.resource_type, notification.resource_id
            """;

        PendingNotification? notification = null;
        await using (var reader = await claimCommand.ExecuteReaderAsync(cancellationToken))
        {
            if (await reader.ReadAsync(cancellationToken))
            {
                notification = new PendingNotification(
                    reader.GetGuid(0),
                    reader.GetGuid(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetGuid(5));
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return notification;
    }

    private async Task<IReadOnlyList<PushSubscriptionRow>> GetSubscriptionsAsync(
        Guid profileId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select endpoint, p256dh, auth
            from public.notification_push_subscriptions
            where profile_id = $1
            """;
        command.Parameters.AddWithValue(profileId);

        var subscriptions = new List<PushSubscriptionRow>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            subscriptions.Add(new PushSubscriptionRow(reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        return subscriptions;
    }

    private async Task RemoveSubscriptionAsync(string endpoint, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "delete from public.notification_push_subscriptions where endpoint = $1";
        command.Parameters.AddWithValue(endpoint);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private sealed record PendingNotification(
        Guid Id,
        Guid ProfileId,
        string Title,
        string Body,
        string ResourceType,
        Guid ResourceId);

    private sealed record PushSubscriptionRow(string Endpoint, string P256dh, string Auth);
}
