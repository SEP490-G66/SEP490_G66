namespace OZE.Common.Models
{
    public class AuthSmsSenderOptions
    {
        public string? AccessToken { get; set; }

        /// <summary>
        /// SpeedSMS type: 2 random, 3 brandname, 4 default Verify/Notify, 5 android app.
        /// </summary>
        public int SmsType { get; set; } = 4;

        /// <summary>
        /// Brandname or default sender (Verify / Notify for type 4).
        /// </summary>
        public string Sender { get; set; } = "Verify";
    }
}
