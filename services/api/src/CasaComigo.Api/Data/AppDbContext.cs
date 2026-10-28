using Microsoft.EntityFrameworkCore;

namespace CasaComigo.Api.Data;

/// <summary>
/// Entry point for the application's EF Core model. The first schema is maintained as
/// a Supabase SQL migration so auth.uid(), RLS and storage policies remain explicit.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
}
