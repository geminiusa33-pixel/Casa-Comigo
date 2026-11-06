namespace CasaComigo.Api.Services;

public interface IStripeCheckoutService
{
    bool IsConfigured { get; }
    IReadOnlyList<string> MissingSettings { get; }
    Task<Uri> CreateDonationSessionAsync(int amountCents, CancellationToken cancellationToken);
}
