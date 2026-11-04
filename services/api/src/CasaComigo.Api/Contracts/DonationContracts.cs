namespace CasaComigo.Api.Contracts;

public sealed record CreateDonationCheckoutRequest(int AmountEuro);

public sealed record CreateDonationCheckoutResponse(string Url);
