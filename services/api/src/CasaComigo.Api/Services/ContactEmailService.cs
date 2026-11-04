using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Services;

/// <summary>Sends public contact messages through the SendGrid v3 API.</summary>
public interface IContactEmailService
{
    bool IsConfigured { get; }

    Task SendAsync(ContactMessageRequest request, CancellationToken cancellationToken);
}

/// <summary>SendGrid-backed contact email delivery.</summary>
public sealed class SendGridContactEmailService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<SendGridContactEmailService> logger) : IContactEmailService
{
    private readonly string? apiKey = configuration["SendGrid:ApiKey"];
    private readonly string? fromEmail = configuration["SendGrid:FromEmail"];
    private readonly string? toEmail = configuration["Contact:ToEmail"];
    private readonly string fromName = configuration["SendGrid:FromName"] ?? "Casa Comigo";

    /// <inheritdoc />
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(apiKey)
        && !string.IsNullOrWhiteSpace(fromEmail)
        && !string.IsNullOrWhiteSpace(toEmail);

    /// <inheritdoc />
    public async Task SendAsync(ContactMessageRequest request, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("SendGrid contact delivery was called before configuration was validated.");

        var senderName = request.Name.Trim().Replace('\r', ' ').Replace('\n', ' ');
        var payload = new
        {
            personalizations = new[] { new { to = new[] { new { email = toEmail } } } },
            from = new { email = fromEmail, name = fromName },
            reply_to = new { email = request.Email.Trim(), name = senderName },
            subject = $"Contacto Casa Comigo: mensagem de {senderName}",
            content = new[]
            {
                new
                {
                    type = "text/plain",
                    value = $"Nome: {request.Name.Trim()}\nEmail: {request.Email.Trim()}\n\n{request.Message.Trim()}"
                }
            }
        };
        using var message = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        try
        {
            using var response = await httpClient.SendAsync(message, cancellationToken);
            if (response.IsSuccessStatusCode)
                return;

            logger.LogError("SendGrid rejected a contact message with status {StatusCode}.", (int)response.StatusCode);
            throw new ContactDeliveryException();
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "SendGrid could not deliver a public contact message.");
            throw new ContactDeliveryException();
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "SendGrid timed out while delivering a public contact message.");
            throw new ContactDeliveryException();
        }
    }
}

/// <summary>Represents a failure to deliver a contact email.</summary>
public sealed class ContactDeliveryException : Exception
{
}
