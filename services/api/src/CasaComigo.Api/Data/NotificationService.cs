using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class NotificationService(
    INotificationRepository repository,
    IConfiguration configuration) : INotificationService
{
    /// <inheritdoc />
    public Task<NotificationListResponse> GetAsync(Guid profileId, CancellationToken cancellationToken) =>
        repository.GetAsync(profileId, cancellationToken);

    /// <inheritdoc />
    public Task<bool> MarkReadAsync(Guid profileId, Guid notificationId, CancellationToken cancellationToken) =>
        repository.MarkReadAsync(profileId, notificationId, cancellationToken);

    /// <inheritdoc />
    public Task MarkAllReadAsync(Guid profileId, CancellationToken cancellationToken) =>
        repository.MarkAllReadAsync(profileId, cancellationToken);

    /// <inheritdoc />
    public async Task SavePushSubscriptionAsync(
        Guid profileId,
        SavePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsPushConfigured)
            throw new ProfileValidationException("As notificações push ainda não estão configuradas na API.");

        await repository.SavePushSubscriptionAsync(profileId, request, cancellationToken);
    }

    /// <inheritdoc />
    public Task DeletePushSubscriptionAsync(Guid profileId, string endpoint, CancellationToken cancellationToken) =>
        repository.DeletePushSubscriptionAsync(profileId, endpoint, cancellationToken);

    /// <inheritdoc />
    public string? GetPushPublicKey()
    {
        var key = configuration["WebPush:VapidPublicKey"];
        return string.IsNullOrWhiteSpace(key) ? null : key;
    }

    /// <inheritdoc />
    public bool IsPushConfigured =>
        GetPushPublicKey() is not null
        && !string.IsNullOrWhiteSpace(configuration["WebPush:VapidPrivateKey"])
        && !string.IsNullOrWhiteSpace(configuration["WebPush:VapidSubject"]);
}
