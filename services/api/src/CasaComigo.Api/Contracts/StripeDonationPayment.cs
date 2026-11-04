namespace CasaComigo.Api.Contracts;

public sealed record StripeDonationPayment(
    string EventId,
    string CheckoutSessionId,
    decimal AmountEuro,
    string Currency);
