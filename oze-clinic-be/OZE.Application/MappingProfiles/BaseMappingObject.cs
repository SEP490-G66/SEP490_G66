using AutoMapper;
using OZE.Application.Helpers;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.MappingProfiles
{
    public class BaseMappingObject : Profile
    {
        public BaseMappingObject()
        {
            CreateMap<UserRefreshToken, UserRefreshTokenDTO>().ReverseMap();
            CreateMap<Service, ServiceDto>()
                .ForMember(dest => dest.ImageUrl, opt => opt.MapFrom(src => ServiceImageHelper.ServiceImageUrl(src.Id, src.ImageUpdatedAt)))
                .ReverseMap();
            CreateMap<CreateServiceRequest, Service>();
            CreateMap<UpdateServiceRequest, Service>();
            CreateMap<ServiceVariant, ServiceVariantDto>()
                .ForMember(dest => dest.ImageUrl, opt => opt.MapFrom(src => ServiceImageHelper.VariantImageUrl(src.ServiceId, src.Id, src.ImageUpdatedAt)));
            CreateMap<Patient, PatientDto>();
            CreateMap<Patient, PatientDetailDto>()
                .ForMember(dest => dest.TotalAppointments, opt => opt.MapFrom(src => src.Appointments.Count));
            CreateMap<CreatePatientRequest, Patient>();
            CreateMap<UpdatePatientRequest, Patient>();
            CreateMap<PatientMedicalProfile, PatientMedicalProfileDto>();
            CreateMap<CreateMedicalProfileRequest, PatientMedicalProfile>();
            CreateMap<Room, RoomResponse>();
        }
    }
}
