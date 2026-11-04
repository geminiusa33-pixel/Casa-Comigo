using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Notification operations for the authenticated profile.</summary>
public interface INotificationService
{
    Task<NotificationListResponse> GetAsync(Guid profileId, CancellationToken cancellationToken);
    Task<bool> MarkReadAsync(Guid profileId, Guid notificationId, CancellationToken cancellationToken);
    Task MarkAllReadAsync(Guid profileId, CancellationToken cancellationToken);
    Task SavePushSubscriptionAsync(Guid profileId, SavePushSubscriptionRequest request, CancellationToken cancellationToken);
    Task DeletePushSubscriptionAsync(Guid profileId, string endpoint, CancellationToken cancellationToken);
    string? GetPushPublicKey();
    bool IsPushConfigured { get; }
}
