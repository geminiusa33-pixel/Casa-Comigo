using System.ComponentModel.DataAnnotations;

namespace CasaComigo.Api.Contracts;

/// <summary>Grupo de coabitação e aprovação de entrada de novos membros.</summary>
public sealed record HousingGroupResponse(
    Guid Id,
    Guid? OriginMatchId,
    string Name,
    int TargetOccupants,
    int MemberCount,
    decimal? TotalMonthlyRentContribution,
    int CompletionConfirmations,
    string Status,
    DateTimeOffset CreatedAt,
    string? MyJoinRequestStatus,
    IReadOnlyList<HousingGroupMemberResponse> Members,
    IReadOnlyList<HousingGroupJoinRequestResponse> PendingRequests);

/// <summary>Perfil público e preferências de convivência mostrados aos membros do grupo.</summary>
public sealed record HousingGroupProfileResponse(
    string Bio,
    int? PreferredHousemates,
    string GenderPreference,
    bool HasPets,
    string[] Interests,
    string Opinions,
    string WorkSchedule,
    string CookingHabits,
    decimal? MonthlyBudget,
    string LeaseHolderPreference,
    string BillsPreference,
    string FurnishedPreference,
    int? PreferredBathrooms,
    int? PreferredBedrooms,
    string HomeTypePreference,
    string MoveInTiming,
    int? MinimumLeaseMonths);

/// <summary>Membro de um grupo aberto, incluindo o limite máximo mensal de renda.</summary>
public sealed record HousingGroupMemberResponse(
    Guid ProfileId,
    string DisplayName,
    string? PhotoPath,
    string AreaLabel,
    decimal? MaximumMonthlyRentContribution,
    bool ConfirmedCompletion,
    HousingGroupProfileResponse Profile);

/// <summary>Pedido pendente para entrar num grupo, sujeito à aprovação de todos os membros.</summary>
public sealed record HousingGroupJoinRequestResponse(
    Guid Id,
    Guid RequesterId,
    string DisplayName,
    string? PhotoPath,
    string AreaLabel,
    decimal? MaximumMonthlyRentContribution,
    int ApprovalCount,
    int RequiredApprovals,
    bool? MyVote,
    DateTimeOffset CreatedAt,
    HousingGroupProfileResponse Profile);

/// <summary>Atualiza o nome apresentado na conversa do grupo.</summary>
public sealed record UpdateHousingGroupNameRequest
{
    /// <summary>Nome curto e reconhecível para o grupo.</summary>
    [Required, StringLength(80, MinimumLength = 1)]
    public required string Name { get; init; }
}

/// <summary>Confirma o pedido de entrada submetido pelo utilizador atual.</summary>
public sealed record HousingGroupJoinRequestCreatedResponse(Guid Id, string Status);

/// <summary>Resultado da votação dos membros sobre um pedido de entrada.</summary>
public sealed record HousingGroupJoinDecisionResponse(string Status);

/// <summary>Voto de um membro atual sobre a entrada de uma pessoa no grupo.</summary>
public sealed record VoteHousingGroupJoinRequest
{
    /// <summary>Indica se aceita a entrada; todos os membros têm de aceitar.</summary>
    public required bool Accept { get; init; }
}

/// <summary>Mensagem publicada na conversa privada de um grupo de coabitação.</summary>
public sealed record HousingGroupMessageResponse(
    Guid Id,
    Guid GroupId,
    Guid SenderId,
    string Body,
    DateTimeOffset SentAt);
