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
        string title;
        string detail;
        switch (exception)
        {
            case ProfileValidationException validationException:
                title = "Dados de perfil inválidos";
                detail = validationException.Message;
                break;
            case BadHttpRequestException:
                title = "Pedido inválido";
                detail = "O corpo do pedido está malformado ou incompleto.";
                break;
            case ChatNotFoundException:
                logger.LogInformation("Conversation request rejected for {Path}", httpContext.Request.Path);
                httpContext.Response.StatusCode = StatusCodes.Status404NotFound;
                await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Type = "https://httpstatuses.com/404",
                    Title = "Conversa não encontrada",
                    Detail = "A conversa não existe ou não está disponível para esta conta.",
                    Status = StatusCodes.Status404NotFound,
                    Instance = httpContext.Request.Path
                }, cancellationToken);
                return true;
            default:
                return false;
        }

        logger.LogInformation("API request rejected: {Title}", title);
        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Type = "https://httpstatuses.com/400",
            Title = title,
            Detail = detail,
            Status = StatusCodes.Status400BadRequest,
            Instance = httpContext.Request.Path
        }, cancellationToken);
        return true;
    }
}
