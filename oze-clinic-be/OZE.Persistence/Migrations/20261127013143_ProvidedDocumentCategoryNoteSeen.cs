using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProvidedDocumentCategoryNoteSeen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "PatientDocuments",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "PatientDocuments",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SeenAt",
                table: "PatientDocuments",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeenByDoctorId",
                table: "PatientDocuments",
                type: "int",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PatientDocuments_SeenByDoctor",
                table: "PatientDocuments",
                column: "SeenByDoctorId",
                principalTable: "StaffProfiles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PatientDocuments_SeenByDoctor",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "SeenAt",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "SeenByDoctorId",
                table: "PatientDocuments");
        }
    }
}
