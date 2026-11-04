using CasaComigo.Api.Contracts;
using CasaComigo.Api.Services;

namespace CasaComigo.Api.Endpoints;

/// <summary>Public contact routes.</summary>
public static class ContactEndpoints
{
    /// <summary>Maps the rate-limited public contact form.</summary>
    public static IEndpointRouteBuilder MapContactEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/contact", async Task<IResult> (
                ContactMessageRequest request,
                IContactEmailService emailService,
                ILogger<Program> logger,
                CancellationToken cancellationToken) =>
            {
                if (!emailService.IsConfigured)
                {
                    logger.LogError(
                        "Public contact form is unavailable. Missing server settings: {MissingSettings}",
                        string.Join(", ", emailService.MissingSettings));
                    return TypedResults.Problem(
                        title: "Contacto temporariamente indisponível",
                        detail: "Falta configurar no processo da API: "
                            + string.Join(", ", emailService.MissingSettings)
                            + ". O ficheiro .env.api.example não é carregado automaticamente; defina estas variáveis no terminal da API e reinicie o backend.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                await emailService.SendAsync(request, cancellationToken);
                return TypedResults.Accepted((string?)null, new { message = "Mensagem enviada." });
            })
            .WithName("SendContactMessage")
            .WithSummary("Envia uma mensagem de contacto para a equipa Divide Casa Comigo")
            .Produces(StatusCodes.Status202Accepted)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .AllowAnonymous()
            .RequireRateLimiting("public-contact");

        return endpoints;
    }
}
