using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Reads in-app notifications and manages the current user's browser push subscriptions.</summary>
public interface INotificationRepository
{
    Task<NotificationListResponse> GetAsync(Guid profileId, CancellationToken cancellationToken);
    Task<bool> MarkReadAsync(Guid profileId, Guid notificationId, CancellationToken cancellationToken);
    Task MarkAllReadAsync(Guid profileId, CancellationToken cancellationToken);
    Task SavePushSubscriptionAsync(Guid profileId, SavePushSubscriptionRequest request, CancellationToken cancellationToken);
    Task DeletePushSubscriptionAsync(Guid profileId, string endpoint, CancellationToken cancellationToken);
}
