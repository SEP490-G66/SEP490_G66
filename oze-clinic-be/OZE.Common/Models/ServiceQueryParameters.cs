using OZE.Common.Models.Base;

namespace OZE.Common.Models
{
    public class ServiceQueryParameters : PagedRequestBase
    {
        public bool? IsActive { get; set; }
        public string? RequiredRoomType { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        // Manager list: return each service's variants in the same request (honoured only for the clinic manager)
        public bool IncludeVariants { get; set; }
    }
}
