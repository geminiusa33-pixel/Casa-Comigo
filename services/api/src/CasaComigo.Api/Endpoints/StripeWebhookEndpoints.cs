using CasaComigo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace CasaComigo.Api.Endpoints;

public static class StripeWebhookEndpoints
{
    private const int MaxPayloadBytes = 64 * 1024;

    public static IEndpointRouteBuilder MapStripeWebhookEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/stripe/webhook", async Task<IResult> (
                HttpRequest request,
                IStripeDonationWebhookService webhookService,
                ILogger<Program> logger,
                CancellationToken cancellationToken) =>
            {
                if (!webhookService.IsConfigured)
                {
                    logger.LogError("Stripe webhook is unavailable because Stripe__WebhookSecret is not configured.");
                    return TypedResults.Problem(
                        title: "Webhook temporariamente indisponível",
                        detail: "A API ainda não tem Stripe__WebhookSecret configurado.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                if (request.ContentLength > MaxPayloadBytes)
                {
                    return TypedResults.Problem(
                        title: "Evento Stripe demasiado grande",
                        statusCode: StatusCodes.Status413PayloadTooLarge);
                }

                var payload = new byte[MaxPayloadBytes + 1];
                var totalBytesRead = 0;
                while (totalBytesRead < payload.Length)
                {
                    var bytesRead = await request.Body.ReadAsync(
                        payload.AsMemory(totalBytesRead),
                        cancellationToken);
                    if (bytesRead == 0)
                        break;
                    totalBytesRead += bytesRead;
                }

                if (totalBytesRead > MaxPayloadBytes)
                {
                    return TypedResults.Problem(
                        title: "Evento Stripe demasiado grande",
                        statusCode: StatusCodes.Status413PayloadTooLarge);
                }

                try
                {
                    var result = await webhookService.HandleAsync(
                        payload.AsMemory(0, totalBytesRead),
                        request.Headers["Stripe-Signature"].FirstOrDefault(),
                        cancellationToken);
                    return result == StripeWebhookHandlingResult.Retry
                        ? TypedResults.Problem(
                            title: "Notificação temporariamente indisponível",
                            detail: "A API não conseguiu processar a notificação. O Stripe poderá tentar novamente.",
                            statusCode: StatusCodes.Status503ServiceUnavailable)
                        : TypedResults.Ok();
                }
                catch (StripeWebhookSignatureException)
                {
                    return TypedResults.Problem(
                        title: "Assinatura Stripe inválida",
                        statusCode: StatusCodes.Status400BadRequest);
                }
                catch (StripeWebhookPayloadException)
                {
                    return TypedResults.Problem(
                        title: "Evento Stripe inválido",
                        statusCode: StatusCodes.Status400BadRequest);
                }
                catch (JsonException)
                {
                    return TypedResults.Problem(
                        title: "Evento Stripe inválido",
                        statusCode: StatusCodes.Status400BadRequest);
                }
            })
            .WithName("HandleStripeWebhook")
            .WithSummary("Recebe notificações assinadas do Stripe e envia email após pagamento confirmado")
            .WithMetadata(new RequestSizeLimitAttribute(MaxPayloadBytes))
            .Produces(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .AllowAnonymous();

        return endpoints;
    }
}
