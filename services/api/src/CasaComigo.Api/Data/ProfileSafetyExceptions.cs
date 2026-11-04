namespace CasaComigo.Api.Data;

/// <summary>Indicates that a profile does not exist.</summary>
public sealed class ProfileSafetyNotFoundException : Exception
{
}

/// <summary>Indicates that a safety action cannot be repeated yet.</summary>
public sealed class ProfileSafetyConflictException(string message) : Exception(message);
