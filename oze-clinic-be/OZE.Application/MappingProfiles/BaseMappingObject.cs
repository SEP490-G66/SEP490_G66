using AutoMapper;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.MappingProfiles
{
    public class BaseMappingObject : Profile
    {
        public BaseMappingObject()
        {
            CreateMap<UserRefreshToken, UserRefreshTokenDTO>().ReverseMap();
            // Variants are added by hand, only when the manager list asks for them
            CreateMap<Service, ServiceDto>()
                .ForMember(dest => dest.Variants, opt => opt.Ignore())
                .ReverseMap()
                .ForMember(dest => dest.Variants, opt => opt.Ignore());
            CreateMap<CreateServiceRequest, Service>();
            CreateMap<UpdateServiceRequest, Service>();
            CreateMap<ServiceVariant, ServiceVariantDto>();
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
