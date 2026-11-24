using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProvidedDocumentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "PerformedOn",
                table: "PatientDocuments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProviderAddress",
                table: "PatientDocuments",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UploadGroupId",
                table: "PatientDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PatientDocuments_UploadGroupId",
                table: "PatientDocuments",
                column: "UploadGroupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PatientDocuments_UploadGroupId",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "PerformedOn",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "ProviderAddress",
                table: "PatientDocuments");

            migrationBuilder.DropColumn(
                name: "UploadGroupId",
                table: "PatientDocuments");
        }
    }
}
