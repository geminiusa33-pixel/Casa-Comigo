namespace CasaComigo.Api.Services;

public sealed class StripeCheckoutException : Exception
{
    public StripeCheckoutException() : base("Stripe Checkout could not create a session.")
    {
    }
}
