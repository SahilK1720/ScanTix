use chrono::{DateTime, Utc};
use lettre::{
    message::header::ContentType,
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};

use crate::config::Config;

/// Builds the subject and plain-text body for a scanner invite email.
/// Returns `(subject, body)`.
pub fn build_scanner_invite_body(
    staff_name: &str,
    organizer_name: &str,
    event_name: &str,
    event_date: &str,
    scanner_link: &str,
) -> (String, String) {
    let subject = format!("You've been added as a scanner for {}", event_name);

    let body = format!(
        "Hi {staff_name},\n\n\
{organizer_name} has added you as a ticket scanner for:\n\n\
  Event: {event_name}\n\
  Date:  {event_date}\n\n\
Your personal scanner link:\n\
  {scanner_link}\n\n\
This link is personal and scoped to this event only.\n\
Do not share it with others.\n\n\
— ScanTix Team\n"
    );

    (subject, body)
}

/// Sends a scanner invite email via SMTP.
/// Returns `Ok(())` on success or `Err(message)` on failure.
pub async fn send_scanner_invite(
    to_email: &str,
    to_name: &str,
    organizer_name: &str,
    event_name: &str,
    event_date: DateTime<Utc>,
    scanner_link: &str,
    config: &Config,
) -> Result<(), String> {
    let event_date_formatted = event_date.format("%B %d, %Y at %H:%M UTC").to_string();

    let (subject, body) = build_scanner_invite_body(
        to_name,
        organizer_name,
        event_name,
        &event_date_formatted,
        scanner_link,
    );

    let to_mailbox = format!("{} <{}>", to_name, to_email)
        .parse()
        .map_err(|e| format!("Invalid recipient address: {}", e))?;

    let from_mailbox = config
        .smtp_from
        .parse()
        .map_err(|e| format!("Invalid sender address: {}", e))?;

    let email = Message::builder()
        .from(from_mailbox)
        .to(to_mailbox)
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body)
        .map_err(|e| format!("Failed to build email message: {}", e))?;

    let creds = Credentials::new(config.smtp_username.clone(), config.smtp_password.clone());

    let transport = if config.smtp_port == 465 {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&config.smtp_host)
            .map_err(|e| format!("Failed to create SMTP transport: {}", e))?
            .port(config.smtp_port)
            .credentials(creds)
            .build()
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.smtp_host)
            .map_err(|e| format!("Failed to create SMTP transport: {}", e))?
            .port(config.smtp_port)
            .credentials(creds)
            .build()
    };

    transport
        .send(email)
        .await
        .map_err(|e| format!("Failed to send email: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_scanner_invite_body_contains_all_fields() {
        let (subject, body) = build_scanner_invite_body(
            "Alice",
            "Bob Organizer",
            "Tech Summit 2025",
            "March 20, 2025 at 09:00 UTC",
            "http://localhost:4200/scan/abc-token",
        );

        assert_eq!(subject, "You've been added as a scanner for Tech Summit 2025");
        assert!(body.contains("Alice"), "body must contain staff name");
        assert!(body.contains("Bob Organizer"), "body must contain organizer name");
        assert!(body.contains("Tech Summit 2025"), "body must contain event name");
        assert!(body.contains("March 20, 2025 at 09:00 UTC"), "body must contain event date");
        assert!(body.contains("http://localhost:4200/scan/abc-token"), "body must contain scanner link");
    }

    #[test]
    fn test_subject_format() {
        let (subject, _) = build_scanner_invite_body(
            "Staff",
            "Organizer",
            "My Event",
            "2025-01-01",
            "http://example.com/scan/token",
        );
        assert_eq!(subject, "You've been added as a scanner for My Event");
    }
}
