namespace CasaComigo.Api.Contracts;

/// <summary>Pedido para iniciar um donativo em euros, com precisão até aos cêntimos.</summary>
public sealed record CreateDonationCheckoutRequest(decimal AmountEuro);

/// <summary>Endereço seguro de Stripe Checkout para concluir o donativo.</summary>
public sealed record CreateDonationCheckoutResponse(string Url);
