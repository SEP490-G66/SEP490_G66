namespace OZE.Application.Helpers
{
    public static class MoneyHelper
    {
        // Money is kept to 2 decimals, halves rounded away from zero
        public static decimal Round(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
