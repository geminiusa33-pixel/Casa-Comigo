using System.Security.Claims;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for the authenticated user's in-app and browser push notifications.</summary>
public static class NotificationEndpoints
{
    /// <summary>Maps authenticated notification and push-subscription operations.</summary>
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/notifications", async Task<IResult> (
                ClaimsPrincipal user,
                INotificationService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                return TypedResults.Ok(await service.GetAsync(profileId, cancellationToken));
            })
            .WithName("GetNotifications")
            .WithSummary("Lista as notificações recentes")
            .WithDescription("Devolve as últimas 50 notificações e a contagem total das não lidas do utilizador autenticado.")
            .Produces<NotificationListResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPut("/notifications/{notificationId:guid}/read", async Task<IResult> (
                Guid notificationId,
                ClaimsPrincipal user,
                INotificationService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                return await service.MarkReadAsync(profileId, notificationId, cancellationToken)
                    ? TypedResults.NoContent()
                    : TypedResults.NotFound();
            })
            .WithName("MarkNotificationRead")
            .WithSummary("Marca uma notificação como lida")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapPut("/notifications/read-all", async Task<IResult> (
                ClaimsPrincipal user,
                INotificationService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                await service.MarkAllReadAsync(profileId, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("MarkAllNotificationsRead")
            .WithSummary("Marca todas as notificações como lidas")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapGet("/notifications/push/vapid-public-key", Task<IResult> (INotificationService service) =>
            {
                var publicKey = service.GetPushPublicKey();
                IResult result = !service.IsPushConfigured || string.IsNullOrWhiteSpace(publicKey)
                    ? TypedResults.Problem(
                        title: "Notificações push não configuradas",
                        detail: "Configure a chave pública VAPID da API para ativar notificações do browser.",
                        statusCode: StatusCodes.Status503ServiceUnavailable)
                    : TypedResults.Ok(new PushPublicKeyResponse(publicKey));
                return Task.FromResult(result);
            })
            .WithName("GetPushVapidPublicKey")
            .WithSummary("Obtém a chave pública para ativar notificações push")
            .Produces<PushPublicKeyResponse>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        endpoints.MapPost("/notifications/push-subscriptions", async Task<IResult> (
                SavePushSubscriptionRequest request,
                ClaimsPrincipal user,
                INotificationService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                if (!service.IsPushConfigured)
                    return TypedResults.Problem(
                        title: "Notificações push não configuradas",
                        detail: "Configure as chaves VAPID e o assunto da aplicação na API.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                await service.SavePushSubscriptionAsync(profileId, request, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("SavePushSubscription")
            .WithSummary("Regista uma subscrição push do browser")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        endpoints.MapDelete("/notifications/push-subscriptions", async Task<IResult> (
                DeletePushSubscriptionRequest request,
                ClaimsPrincipal user,
                INotificationService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                await service.DeletePushSubscriptionAsync(profileId, request.Endpoint, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("DeletePushSubscription")
            .WithSummary("Remove a subscrição push deste browser")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return endpoints;
    }

    private static bool TryGetProfileId(ClaimsPrincipal user, out Guid profileId)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out profileId);
    }
}
