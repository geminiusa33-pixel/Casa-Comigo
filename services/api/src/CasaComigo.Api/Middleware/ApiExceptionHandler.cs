using CasaComigo.Api.Data;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CasaComigo.Api.Middleware;

/// <summary>Converts expected API exceptions to safe HTTP problem responses.</summary>
public sealed class ApiExceptionHandler(
    ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        switch (exception)
        {
            case ProfileValidationException validationException:
                logger.LogInformation("API request rejected: {Title}", "Dados de perfil inválidos");
                await WriteProblemDetailsAsync(
                    httpContext,
                    StatusCodes.Status400BadRequest,
                    "Dados de perfil inválidos",
                    validationException.Message,
                    cancellationToken);
                return true;
            case BadHttpRequestException:
                logger.LogInformation("Malformed API request rejected for {Path}", httpContext.Request.Path);
                await WriteProblemDetailsAsync(
                    httpContext,
                    StatusCodes.Status400BadRequest,
                    "Pedido inválido",
                    "O corpo do pedido está malformado ou incompleto.",
                    cancellationToken);
                return true;
            case ChatNotFoundException:
                await WriteProblemDetailsAsync(
                    httpContext,
                    StatusCodes.Status404NotFound,
                    "Conversa não encontrada",
                    "A conversa não existe ou não está disponível para esta conta.",
                    cancellationToken);
                return true;
            case ProfileSafetyNotFoundException:
                logger.LogInformation("Profile safety request rejected for {Path}", httpContext.Request.Path);
                await WriteProblemDetailsAsync(
                    httpContext,
                    StatusCodes.Status404NotFound,
                    "Perfil não encontrado",
                    "O perfil indicado não existe.",
                    cancellationToken);
                return true;
            case ProfileSafetyConflictException conflictException:
                logger.LogInformation("Profile safety request throttled for {Path}", httpContext.Request.Path);
                await WriteProblemDetailsAsync(
                    httpContext,
                    StatusCodes.Status409Conflict,
                    "Ação temporariamente indisponível",
                    conflictException.Message,
                    cancellationToken);
                return true;
            default:
                return false;
        }
    }

    private static Task WriteProblemDetailsAsync(
        HttpContext httpContext,
        int statusCode,
        string title,
        string detail,
        CancellationToken cancellationToken)
    {
        httpContext.Response.StatusCode = statusCode;
        return httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Type = $"https://httpstatuses.com/{statusCode}",
            Title = title,
            Detail = detail,
            Status = statusCode,
            Instance = httpContext.Request.Path
        }, cancellationToken);
    }
}
