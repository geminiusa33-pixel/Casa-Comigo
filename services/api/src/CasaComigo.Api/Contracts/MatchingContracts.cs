namespace CasaComigo.Api.Contracts;

/// <summary>Resultado de um gosto enviado a outro perfil.</summary>
public sealed record LikeResponse(bool Liked, bool IsMatch, Guid? MatchId);

/// <summary>Match recíproco com a apresentação não precisa da outra pessoa.</summary>
public sealed record MatchResponse(
    Guid Id,
    Guid ProfileId,
    string DisplayName,
    string Bio,
    int? PreferredHousemates,
    bool HasPets,
    string[] Interests,
    string AreaLabel,
    DateTimeOffset MatchedAt);
