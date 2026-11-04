namespace CasaComigo.Api.Data;

public enum StripeWebhookClaimResult
{
    Claimed,
    AlreadyProcessed,
    Processing
}

public interface IStripeWebhookEventRepository
{
    Task<StripeWebhookClaimResult> TryClaimAsync(string eventId, CancellationToken cancellationToken);
    Task MarkProcessedAsync(string eventId, CancellationToken cancellationToken);
    Task MarkFailedAsync(string eventId, CancellationToken cancellationToken);
}
