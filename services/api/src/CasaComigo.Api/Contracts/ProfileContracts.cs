using System.ComponentModel.DataAnnotations;

namespace CasaComigo.Api.Contracts;

/// <summary>Dados pessoais e preferências de partilha da conta autenticada.</summary>
public sealed record ProfileResponse(
    Guid Id,
    string DisplayName,
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
    int? MinimumLeaseMonths,
    bool DiscoveryVisible,
    bool ProfileComplete,
    SearchAreaResponse? SearchArea,
    string? PhotoPath,
    DateTimeOffset UpdatedAt);

/// <summary>Dados privados da zona de procura, devolvidos apenas ao próprio utilizador.</summary>
public sealed record SearchAreaResponse(
    double Latitude,
    double Longitude,
    double RadiusKm,
    string AreaLabel,
    string LocationSource,
    DateTimeOffset UpdatedAt);

/// <summary>Atualização dos dados pessoais e preferências de partilha.</summary>
public sealed record UpdateProfileRequest
{
    /// <summary>Nome visível nos cartões de descoberta.</summary>
    [Required, StringLength(80, MinimumLength = 2)]
    public required string DisplayName { get; init; }

    /// <summary>Apresentação pessoal para potenciais colegas de casa.</summary>
    [StringLength(2000)]
    public string Bio { get; init; } = "";

    /// <summary>Número total de pessoas que pretende na casa, incluindo o próprio utilizador.</summary>
    [Required, Range(2, 20)]
    public required int PreferredHousemates { get; init; }

    /// <summary>Preferência de género: any, women, men ou other.</summary>
    [Required, RegularExpression("^(any|women|men|other)$")]
    public required string GenderPreference { get; init; }

    /// <summary>Indica se o utilizador tem ou aceita animais em casa.</summary>
    public bool HasPets { get; init; }

    /// <summary>Interesses pessoais, até vinte etiquetas.</summary>
    [MaxLength(20)]
    public string[] Interests { get; init; } = [];

    /// <summary>Interesses ou opiniões relevantes para a convivência.</summary>
    [StringLength(2000)]
    public string Opinions { get; init; } = "";

    /// <summary>Horários e rotina de trabalho.</summary>
    [StringLength(500)]
    public string WorkSchedule { get; init; } = "";

    /// <summary>Hábitos relacionados com cozinhar e partilhar a cozinha.</summary>
    [StringLength(500)]
    public string CookingHabits { get; init; } = "";

    /// <summary>Contribuição mensal máxima pretendida em euros; não filtra matches.</summary>
    [Range(typeof(decimal), "0", "100000")]
    public decimal? MonthlyBudget { get; init; }

    /// <summary>Preferência sobre quem assina o contrato; não filtra matches.</summary>
    [Required, RegularExpression("^(any|own_name|joint|other)$")]
    public string LeaseHolderPreference { get; init; } = "any";

    /// <summary>Preferência para dividir despesas e recibos; não filtra matches.</summary>
    [Required, RegularExpression("^(discuss|split_equally|separate)$")]
    public string BillsPreference { get; init; } = "discuss";

    /// <summary>Preferência sobre mobília; não filtra matches.</summary>
    [Required, RegularExpression("^(any|furnished|unfurnished|partial)$")]
    public string FurnishedPreference { get; init; } = "any";

    /// <summary>Número de casas de banho preferido; não filtra matches.</summary>
    [Range(1, 20)]
    public int? PreferredBathrooms { get; init; }

    /// <summary>Número de quartos preferido; não filtra matches.</summary>
    [Range(1, 30)]
    public int? PreferredBedrooms { get; init; }

    /// <summary>Tipo de casa preferido; não filtra matches.</summary>
    [Required, RegularExpression("^(any|apartment|house|room)$")]
    public string HomeTypePreference { get; init; } = "any";

    /// <summary>Prazo de mudança pretendido; não filtra matches.</summary>
    [Required, RegularExpression("^(flexible|immediately|one_to_three_months|three_plus_months)$")]
    public string MoveInTiming { get; init; } = "flexible";

    /// <summary>Duração mínima do contrato em meses; não filtra matches.</summary>
    [Range(1, 120)]
    public int? MinimumLeaseMonths { get; init; }

    /// <summary>Autoriza a apresentação do perfil a pessoas em zona mutuamente compatível.</summary>
    public bool DiscoveryVisible { get; init; }
}

/// <summary>Atualização da zona e do raio de procura do utilizador autenticado.</summary>
public sealed record UpdateSearchAreaRequest
{
    /// <summary>Latitude da zona de procura; guardada privadamente.</summary>
    [Range(-90, 90)]
    public required double Latitude { get; init; }

    /// <summary>Longitude da zona de procura; guardada privadamente.</summary>
    [Range(-180, 180)]
    public required double Longitude { get; init; }

    /// <summary>Raio pretendido em quilómetros, até 250 km.</summary>
    [Range(0.1, 250)]
    public required double RadiusKm { get; init; }

    /// <summary>Nome aproximado da cidade ou área; nunca inclui as coordenadas.</summary>
    [Required, StringLength(160, MinimumLength = 1)]
    public required string AreaLabel { get; init; }

    /// <summary>Origem consentida da localização: gps ou manual.</summary>
    [Required, RegularExpression("^(gps|manual)$")]
    public required string LocationSource { get; init; }
}

/// <summary>Perfil compatível apresentado na descoberta, sem coordenadas precisas.</summary>
public sealed record DiscoveryProfileResponse(
    Guid Id,
    string DisplayName,
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
    int? MinimumLeaseMonths,
    string? PhotoPath,
    string AreaLabel);
