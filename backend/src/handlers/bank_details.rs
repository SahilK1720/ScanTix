use axum::{
    extract::State,
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::AppError;
use crate::utils::jwt::Claims;
use crate::AppState;

// ─── Models ─────────────────────────────────────────────────────────────────

#[derive(Debug, FromRow, Serialize, Clone)]
pub struct OrganizerBankDetails {
    pub id: Uuid,
    pub organizer_id: Uuid,
    pub account_holder_name: String,
    pub bank_name: String,
    /// Masked — last 4 digits only, padded with X
    pub account_number: String,
    pub ifsc_code: String,
    pub branch_name: Option<String>,
    pub upi_id: Option<String>,
    pub pan_number: Option<String>,
    pub account_type: String,
    pub is_verified: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct BankDetailsRaw {
    pub id: Uuid,
    pub organizer_id: Uuid,
    pub account_holder_name: String,
    pub bank_name: String,
    pub account_number: String,
    pub ifsc_code: String,
    pub branch_name: Option<String>,
    pub upi_id: Option<String>,
    pub pan_number: Option<String>,
    pub account_type: String,
    pub is_verified: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

impl BankDetailsRaw {
    fn into_masked(self) -> OrganizerBankDetails {
        let masked = mask_account_number(&self.account_number);
        OrganizerBankDetails {
            id: self.id,
            organizer_id: self.organizer_id,
            account_holder_name: self.account_holder_name,
            bank_name: self.bank_name,
            account_number: masked,
            ifsc_code: self.ifsc_code,
            branch_name: self.branch_name,
            upi_id: self.upi_id,
            pan_number: self.pan_number,
            account_type: self.account_type,
            is_verified: self.is_verified,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn mask_account_number(acc: &str) -> String {
    if acc.len() <= 4 {
        return acc.to_string();
    }
    let suffix = &acc[acc.len() - 4..];
    let masked: String = "X".repeat(acc.len() - 4);
    format!("{}{}", masked, suffix)
}

#[derive(Debug, Deserialize)]
pub struct SaveBankDetailsRequest {
    pub account_holder_name: String,
    pub bank_name: String,
    pub account_number: String,
    pub confirm_account_number: String,
    pub ifsc_code: String,
    pub branch_name: Option<String>,
    pub upi_id: Option<String>,
    pub pan_number: Option<String>,
    pub account_type: String,
}

fn validate_ifsc(ifsc: &str) -> bool {
    // IFSC format: 4 uppercase letters + '0' + 6 alphanumeric chars = 11 chars
    if ifsc.len() != 11 {
        return false;
    }
    let bytes = ifsc.as_bytes();
    // First 4 must be uppercase letters
    for b in &bytes[0..4] {
        if !b.is_ascii_uppercase() { return false; }
    }
    // 5th char must be '0'
    if bytes[4] != b'0' { return false; }
    // Last 6 must be alphanumeric
    for b in &bytes[5..] {
        if !b.is_ascii_alphanumeric() { return false; }
    }
    true
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// GET /api/organizer/bank-details
pub async fn get_bank_details(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Option<OrganizerBankDetails>>, AppError> {
    if claims.role != "organizer" && claims.role != "admin" {
        return Err(AppError::Forbidden("Only organizers can access bank details".to_string()));
    }

    let row = sqlx::query_as::<_, BankDetailsRaw>(
        "SELECT * FROM organizer_bank_details WHERE organizer_id = $1"
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(row.map(|r| r.into_masked())))
}

/// POST /api/organizer/bank-details
pub async fn create_bank_details(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<SaveBankDetailsRequest>,
) -> Result<Json<OrganizerBankDetails>, AppError> {
    if claims.role != "organizer" && claims.role != "admin" {
        return Err(AppError::Forbidden("Only organizers can save bank details".to_string()));
    }

    validate_bank_input(&input)?;

    let raw = sqlx::query_as::<_, BankDetailsRaw>(
        r#"INSERT INTO organizer_bank_details
           (organizer_id, account_holder_name, bank_name, account_number, ifsc_code,
            branch_name, upi_id, pan_number, account_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *"#
    )
    .bind(claims.sub)
    .bind(input.account_holder_name.trim())
    .bind(input.bank_name.trim())
    .bind(input.account_number.trim())
    .bind(input.ifsc_code.trim().to_uppercase())
    .bind(input.branch_name.as_deref().map(str::trim))
    .bind(input.upi_id.as_deref().map(str::trim))
    .bind(input.pan_number.as_deref().map(str::trim).map(|s| s.to_uppercase()))
    .bind(input.account_type.trim().to_lowercase())
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::Conflict("Bank details already exist. Use PUT to update.".to_string())
        } else {
            AppError::Database(e)
        }
    })?;

    Ok(Json(raw.into_masked()))
}

/// PUT /api/organizer/bank-details
pub async fn update_bank_details(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<SaveBankDetailsRequest>,
) -> Result<Json<OrganizerBankDetails>, AppError> {
    if claims.role != "organizer" && claims.role != "admin" {
        return Err(AppError::Forbidden("Only organizers can update bank details".to_string()));
    }

    validate_bank_input(&input)?;

    let raw = sqlx::query_as::<_, BankDetailsRaw>(
        r#"UPDATE organizer_bank_details SET
           account_holder_name = $2,
           bank_name = $3,
           account_number = $4,
           ifsc_code = $5,
           branch_name = $6,
           upi_id = $7,
           pan_number = $8,
           account_type = $9,
           updated_at = NOW()
           WHERE organizer_id = $1
           RETURNING *"#
    )
    .bind(claims.sub)
    .bind(input.account_holder_name.trim())
    .bind(input.bank_name.trim())
    .bind(input.account_number.trim())
    .bind(input.ifsc_code.trim().to_uppercase())
    .bind(input.branch_name.as_deref().map(str::trim))
    .bind(input.upi_id.as_deref().map(str::trim))
    .bind(input.pan_number.as_deref().map(str::trim).map(|s| s.to_uppercase()))
    .bind(input.account_type.trim().to_lowercase())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Bank details not found. Use POST to create.".to_string()))?;

    Ok(Json(raw.into_masked()))
}

fn validate_bank_input(input: &SaveBankDetailsRequest) -> Result<(), AppError> {
    if input.account_holder_name.trim().is_empty() {
        return Err(AppError::BadRequest("Account holder name is required".to_string()));
    }
    if input.bank_name.trim().is_empty() {
        return Err(AppError::BadRequest("Bank name is required".to_string()));
    }
    if input.account_number.trim().len() < 8 {
        return Err(AppError::BadRequest("Account number is too short".to_string()));
    }
    if input.account_number.trim() != input.confirm_account_number.trim() {
        return Err(AppError::BadRequest("Account numbers do not match".to_string()));
    }
    if !validate_ifsc(input.ifsc_code.trim().to_uppercase().as_str()) {
        return Err(AppError::BadRequest("Invalid IFSC code format (e.g. SBIN0001234)".to_string()));
    }
    if input.account_type.trim() != "savings" && input.account_type.trim() != "current" {
        return Err(AppError::BadRequest("Account type must be 'savings' or 'current'".to_string()));
    }
    Ok(())
}
