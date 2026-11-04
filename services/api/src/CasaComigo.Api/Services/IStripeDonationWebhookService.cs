namespace CasaComigo.Api.Services;

public enum StripeWebhookHandlingResult
{
    Processed,
    Ignored,
    Retry
}

public interface IStripeDonationWebhookService
{
    bool IsConfigured { get; }
    Task<StripeWebhookHandlingResult> HandleAsync(
        ReadOnlyMemory<byte> payload,
        string? signatureHeader,
        CancellationToken cancellationToken);
}
