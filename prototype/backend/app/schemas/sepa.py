from datetime import date
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field


class SepaExportRequest(BaseModel):
    """Paramètres de génération du fichier de télétransmission bancaire SEPA pain.001."""

    execution_date: str | None = Field(
        default=None,
        description="Date d'exécution du virement bancaire (format AAAA-MM-JJ). Par défaut : lendemain ouvré.",
    )
    debtor_name: str | None = Field(
        default=None,
        description="Nom de l'émetteur/débiteur (par défaut : nom de l'éditeur configuré dans les réglages).",
    )
    debtor_iban: str | None = Field(
        default=None,
        description="IBAN du compte bancaire débité de l'éditeur.",
    )
    debtor_bic: str | None = Field(
        default=None,
        description="Code BIC/SWIFT de la banque de l'éditeur.",
    )
    remittance_prefix: str = Field(
        default="KOROM ROYALTIES",
        max_length=40,
        description="Préfixe du libellé de virement apparaissant sur le relevé bancaire de l'ayant droit.",
    )
    allow_unverified_ibans: bool = Field(
        default=False,
        description="Autorise l'export même si certains IBANs de test/démonstration ne respectent pas le modulo-97 strict.",
    )


class SepaPayeeSummary(BaseModel):
    """Détail d'un ayant droit ou héritier inclus dans le virement groupé SEPA."""

    holder_id: str | None = None
    name: str = Field(..., description="Nom complet du créancier (bénéficiaire du virement)")
    role: str | None = Field(default=None, description="Rôle CISAC (A, C, E, etc.)")
    amount_eur: Decimal = Field(..., description="Montant net à virer en euros")
    iban: str = Field(..., description="IBAN du compte bénéficiaire")
    formatted_iban: str = Field(default="", description="IBAN espacé pour affichage lisible")
    bic: str | None = Field(default=None, description="Code BIC/SWIFT")
    is_valid_iban: bool = Field(..., description="Conformité ISO 13616 / modulo 97 de l'IBAN")
    is_valid_bic: bool = Field(default=True, description="Conformité du code BIC/SWIFT")
    remittance_info: str = Field(..., description="Libellé de virement transmis à la banque")
    end_to_end_id: str = Field(..., description="Identifiant unique de transaction de bout en bout (max 35 car.)")
    is_heir: bool = Field(default=False, description="Indique si le paiement est issu d'une succession notariale")
    heir_relationship: str | None = Field(default=None, description="Lien de parenté de l'héritier")
    is_mandated: bool = Field(default=False, description="Indique si le virement est mandaté vers un tiers payé")
    mandated_original_holder: str | None = Field(default=None, description="Nom de l'auteur d'origine si tiers payé")


class SepaSkippedPayeeSummary(BaseModel):
    """Ayant droit exclu du virement groupé avec justification métier."""

    holder_id: str | None = None
    name: str
    role: str | None = None
    amount_eur: Decimal = Decimal("0.00")
    reason: str = Field(..., description="Motif d'exclusion (solde nul, sous-seuil < 50€, avance non amortie, IBAN manquant)")
    payout_status: str = Field(default="ZERO_BALANCE")


class SepaValidationReport(BaseModel):
    """Audit préalable de conformité bancaire avant émission du virement SEPA."""

    statement_id: str
    source_name: str
    period_label: str
    execution_date: str
    is_ready_for_export: bool = Field(..., description="Vrai si au moins un virement est valide et l'IBAN débiteur est conforme")
    total_payable_recipients: int
    total_valid_recipients: int
    total_invalid_recipients: int
    total_amount_eur: Decimal
    debtor_name: str
    debtor_iban: str
    debtor_bic: str | None
    is_valid_debtor_iban: bool
    payees: list[SepaPayeeSummary]
    skipped: list[SepaSkippedPayeeSummary]


class SepaExportResponse(BaseModel):
    """Fichier XML SEPA ISO 20022 pain.001 généré et métadonnées d'audit bancaire."""

    filename: str = Field(..., description="Nom de fichier normé (ex: SEPA_PAIN001_KOROM_20261112.xml)")
    xml_content: str = Field(..., description="Contenu complet du document XML conforme à la norme pain.001.001.03")
    message_id: str = Field(..., description="Identifiant unique du message Group Header (MsgId)")
    payment_info_id: str = Field(..., description="Identifiant du lot de paiement (PmtInfId)")
    total_transactions: int
    total_amount_eur: Decimal
    execution_date: str
    debtor_name: str
    debtor_iban: str
    debtor_bic: str | None
    included_payees: list[SepaPayeeSummary]
    skipped_payees: list[SepaSkippedPayeeSummary]
