using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "DocumentRequestId",
                table: "PatientDocuments",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DocumentRequests",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExaminationId = table.Column<long>(type: "bigint", nullable: false),
                    PatientId = table.Column<int>(type: "int", nullable: false),
                    RequestedByDoctorId = table.Column<int>(type: "int", nullable: false),
                    DocumentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSDATETIMEOFFSET()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentRequests", x => x.Id);
                    table.CheckConstraint("CK_DocumentRequests_Status", "[Status] IN ('Pending', 'Submitted', 'Cancelled')");
                    table.ForeignKey(
                        name: "FK_DocumentRequests_Doctors",
                        column: x => x.RequestedByDoctorId,
                        principalTable: "StaffProfiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DocumentRequests_Examinations",
                        column: x => x.ExaminationId,
                        principalTable: "Examinations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DocumentRequests_Patients",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_PatientDocuments_DocumentRequestId",
                table: "PatientDocuments",
                column: "DocumentRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRequests_ExaminationId",
                table: "DocumentRequests",
                column: "ExaminationId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRequests_PatientId",
                table: "DocumentRequests",
                columns: new[] { "PatientId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_PatientDocuments_DocumentRequests",
                table: "PatientDocuments",
                column: "DocumentRequestId",
                principalTable: "DocumentRequests",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PatientDocuments_DocumentRequests",
                table: "PatientDocuments");

            migrationBuilder.DropTable(
                name: "DocumentRequests");

            migrationBuilder.DropIndex(
                name: "IX_PatientDocuments_DocumentRequestId",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "DocumentRequestId",
                table: "PatientDocuments");
        }
    }
}
