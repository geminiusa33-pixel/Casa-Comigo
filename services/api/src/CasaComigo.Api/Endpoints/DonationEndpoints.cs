using CasaComigo.Api.Contracts;
using CasaComigo.Api.Services;

namespace CasaComigo.Api.Endpoints;

public static class DonationEndpoints
{
    private const decimal MinimumDonationEuro = 0.50m;
    private const decimal MaximumDonationEuro = 20m;

    public static IEndpointRouteBuilder MapDonationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/donations/checkout", async Task<IResult> (
                CreateDonationCheckoutRequest request,
                IStripeCheckoutService checkoutService,
                ILogger<Program> logger,
                CancellationToken cancellationToken) =>
            {
                var amountCents = request.AmountEuro * 100m;
                if (request.AmountEuro < MinimumDonationEuro
                    || request.AmountEuro > MaximumDonationEuro
                    || amountCents != decimal.Truncate(amountCents))
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        [nameof(request.AmountEuro)] = ["Escolhe um valor entre 0,50 € e 20 €, com no máximo duas casas decimais."]
                    });
                }

                if (!checkoutService.IsConfigured)
                {
                    logger.LogError(
                        "Stripe donations are unavailable. Missing or invalid server settings: {MissingSettings}",
                        string.Join(", ", checkoutService.MissingSettings));
                    return TypedResults.Problem(
                        title: "Apoios temporariamente indisponíveis",
                        detail: "A API ainda não tem Stripe__SecretKey e Payments__FrontendBaseUrl configurados corretamente.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                try
                {
                    var checkoutUrl = await checkoutService.CreateDonationSessionAsync(
                        decimal.ToInt32(amountCents),
                        cancellationToken);
                    return TypedResults.Ok(new CreateDonationCheckoutResponse(checkoutUrl.ToString()));
                }
                catch (StripeCheckoutException)
                {
                    return TypedResults.Problem(
                        title: "Não foi possível iniciar o pagamento",
                        detail: "O Stripe não conseguiu iniciar o pagamento. Tenta novamente mais tarde.",
                        statusCode: StatusCodes.Status502BadGateway);
                }
            })
            .WithName("CreateDonationCheckout")
            .WithSummary("Cria uma sessão segura do Stripe Checkout para um donativo")
            .Produces<CreateDonationCheckoutResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .AllowAnonymous()
            .RequireRateLimiting("public-donations");

        return endpoints;
    }
}
