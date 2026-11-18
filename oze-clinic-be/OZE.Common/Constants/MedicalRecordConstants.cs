using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OZE.Common.Constants
{
    public class MedicalRecordConstants
    {
        // Appointments that let the doctor of the appointment read the patient's record
        public static readonly string[] AccessAppointmentStatuses =
        {
            AppointmentConstants.ConfirmedStatus, AppointmentConstants.CheckedInStatus,
            AppointmentConstants.InServiceStatus, AppointmentConstants.CompletedStatus
        };

        public const string ActiveProfileStatus = "Active";
        public const string RejectedImageStatus = "Rejected";
        // A new image waits for the doctor (CK_ImagingResults_ReviewStatus)
        public const string PendingImageStatus = "Pending";
        // The doctor read the image and kept it
        public const string ReviewedImageStatus = "Reviewed";

        // Plans the patient sees: a draft is not sent yet and a superseded plan was replaced by a newer version
        public static readonly string[] PatientVisiblePlanStatuses =
        {
            TreatmentPlanConstants.Proposed, TreatmentPlanConstants.Approved, TreatmentPlanConstants.InProgress,
            TreatmentPlanConstants.Completed, TreatmentPlanConstants.Cancelled
        };

        public const string FinalizedPrescriptionStatus = "Finalized";
    }
}
