using OZE.Domain.Entities;

namespace OZE.Application.Helpers
{
    // Who arranged an appointment decides what the patient may do with it online: one they booked themselves they can
    // move or cancel; a treatment session or a follow-up the clinic arranged they can only ask the front desk to change.
    public static class AppointmentOwnershipHelper
    {
        public static bool IsBookedByPatient(Appointment appointment)
        {
            // A treatment session is always arranged by the doctor and the front desk
            if (appointment.TreatmentPlanStageId != null)
            {
                return false;
            }
            // Booked from the patient's own account
            if (!string.IsNullOrEmpty(appointment.CreatedByUserId))
            {
                return appointment.Patient?.UserId != null && appointment.CreatedByUserId == appointment.Patient.UserId;
            }
            // No creator recorded (online booking without an account, older rows): the patient's own unless it is a
            // session of a plan or a follow-up, which only the clinic arranges
            return appointment.TreatmentPlanStageId == null && appointment.ParentAppointmentId == null;
        }
    }
}
