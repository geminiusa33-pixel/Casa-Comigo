using System.Security.Claims;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for housing-group discovery, unanimous decisions, and group chat.</summary>
public static class HousingGroupEndpoints
{
    /// <summary>Maps authenticated housing-group operations.</summary>
    public static IEndpointRouteBuilder MapHousingGroupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/housing-groups", async Task<IResult> (
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                return TypedResults.Ok(await service.GetMyGroupsAsync(profileId, cancellationToken));
            })
            .WithName("GetMyHousingGroups")
            .WithSummary("Lista os grupos de coabitação do utilizador")
            .WithDescription("Inclui ocupação, confirmação de conclusão, pedidos de entrada pendentes e votos dos membros.")
            .Produces<IReadOnlyList<HousingGroupResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapGet("/housing-groups/discovery", async Task<IResult> (
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                return TypedResults.Ok(await service.GetDiscoverableGroupsAsync(profileId, cancellationToken));
            })
            .WithName("DiscoverHousingGroups")
            .WithSummary("Descobre grupos abertos com lugares disponíveis")
            .WithDescription("Só apresenta grupos com a mesma lotação escolhida e zona mutuamente compatível com todos os membros.")
            .Produces<IReadOnlyList<HousingGroupResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPut("/housing-groups/{groupId:guid}/name", async Task<IResult> (
                Guid groupId,
                UpdateHousingGroupNameRequest request,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                await service.RenameAsync(profileId, groupId, request, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("RenameHousingGroup")
            .WithSummary("Altera o nome de um grupo")
            .WithDescription("Qualquer membro pode alterar o nome apresentado na conversa do grupo.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapDelete("/housing-groups/{groupId:guid}/members/me", async Task<IResult> (
                Guid groupId,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                await service.LeaveAsync(profileId, groupId, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("LeaveHousingGroup")
            .WithSummary("Sai de um grupo de coabitação")
            .WithDescription("Remove o utilizador do grupo; um grupo sem membros é encerrado automaticamente.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapPost("/housing-groups/{groupId:guid}/join-requests", async Task<IResult> (
                Guid groupId,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var requestId = await service.RequestJoinAsync(profileId, groupId, cancellationToken);
                return TypedResults.Ok(new HousingGroupJoinRequestCreatedResponse(requestId, "pending"));
            })
            .WithName("RequestHousingGroupMembership")
            .WithSummary("Pede para entrar num grupo aberto")
            .WithDescription("O grupo tem de ter lugares, lotação igual e compatibilidade geográfica mútua com cada membro.")
            .Produces<HousingGroupJoinRequestCreatedResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPost("/housing-groups/join-requests/{requestId:guid}/votes", async Task<IResult> (
                Guid requestId,
                VoteHousingGroupJoinRequest request,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var status = await service.VoteJoinRequestAsync(profileId, requestId, request, cancellationToken);
                return TypedResults.Ok(new HousingGroupJoinDecisionResponse(status));
            })
            .WithName("VoteHousingGroupJoinRequest")
            .WithSummary("Aceita ou recusa um pedido de entrada")
            .WithDescription("Um único voto negativo recusa o pedido; a entrada só é aprovada com o voto positivo de todos os membros.")
            .Produces<HousingGroupJoinDecisionResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapPost("/housing-groups/{groupId:guid}/completion-confirmations", async Task<IResult> (
                Guid groupId,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                await service.ConfirmCompletionAsync(profileId, groupId, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("ConfirmHousingGroupCompletion")
            .WithSummary("Confirma que o grupo pode deixar de aparecer na descoberta")
            .WithDescription("O grupo só passa a concluído quando todos os membros confirmarem.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapGet("/housing-groups/{groupId:guid}/messages", async Task<IResult> (
                Guid groupId,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                return TypedResults.Ok(await service.GetMessagesAsync(profileId, groupId, cancellationToken));
            })
            .WithName("GetHousingGroupMessages")
            .WithSummary("Obtém as mensagens recentes de um grupo")
            .WithDescription("Só os membros do grupo não bloqueados podem ler as últimas 100 mensagens.")
            .Produces<IReadOnlyList<HousingGroupMessageResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPost("/housing-groups/{groupId:guid}/messages", async Task<IResult> (
                Guid groupId,
                SendMessageRequest request,
                ClaimsPrincipal user,
                IHousingGroupService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();
                return TypedResults.Ok(await service.SendMessageAsync(profileId, groupId, request, cancellationToken));
            })
            .WithName("SendHousingGroupMessage")
            .WithSummary("Envia uma mensagem na conversa do grupo")
            .WithDescription("Só os membros do grupo podem enviar mensagens; o texto pode ter até 4000 caracteres.")
            .Produces<HousingGroupMessageResponse>()
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
