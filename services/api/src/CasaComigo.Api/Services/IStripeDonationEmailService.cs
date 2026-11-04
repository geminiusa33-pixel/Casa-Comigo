using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Services;

public interface IStripeDonationEmailService
{
    bool IsConfigured { get; }
    IReadOnlyList<string> MissingSettings { get; }
    Task SendPaymentReceivedAsync(StripeDonationPayment payment, CancellationToken cancellationToken);
}
