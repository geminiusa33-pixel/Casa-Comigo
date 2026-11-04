using System.Security.Claims;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for messages exchanged by matched participants.</summary>
public static class ChatEndpoints
{
    /// <summary>Maps authenticated match conversation endpoints.</summary>
    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/matches/{matchId:guid}/messages", async Task<IResult> (
                Guid matchId,
                ClaimsPrincipal user,
                IChatService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var messages = await service.GetMessagesAsync(profileId, matchId, cancellationToken);
                return TypedResults.Ok(messages);
            })
            .WithName("GetMatchMessages")
            .WithSummary("Obtém as últimas mensagens de uma conversa")
            .WithDescription("Só os participantes de um match não bloqueado podem ler as mensagens; devolve as 100 mais recentes.")
            .Produces<IReadOnlyList<MessageResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapPost("/matches/{matchId:guid}/messages", async Task<IResult> (
                Guid matchId,
                SendMessageRequest request,
                ClaimsPrincipal user,
                IChatService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var message = await service.SendMessageAsync(profileId, matchId, request, cancellationToken);
                return TypedResults.Ok(message);
            })
            .WithName("SendMatchMessage")
            .WithSummary("Envia uma mensagem numa conversa de match")
            .WithDescription("O utilizador tem de ser participante do match, não bloqueado; o texto pode ter até 4000 caracteres.")
            .Produces<MessageResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return endpoints;
    }

    private static bool TryGetProfileId(ClaimsPrincipal user, out Guid profileId)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out profileId);
    }
}
