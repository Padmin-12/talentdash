-- DB-level CHECK constraints for TalentDash Salary table.
-- These enforce the integration contract at the DB layer — not just application code.
-- Invalid data is rejected even if it bypasses API validation.

-- experience_years: must be between 1 and 50 (inclusive)
ALTER TABLE "Salary" ADD CONSTRAINT "salary_experience_years_check"
  CHECK ("experience_years" > 0 AND "experience_years" < 51);

-- base_salary: must be positive (no free salaries, no negative entries)
ALTER TABLE "Salary" ADD CONSTRAINT "salary_base_salary_check"
  CHECK ("base_salary" > 0);

-- confidence_score: must be between 0.0 and 1.0 inclusive
ALTER TABLE "Salary" ADD CONSTRAINT "salary_confidence_score_check"
  CHECK ("confidence_score" >= 0.0 AND "confidence_score" <= 1.0);

-- bonus: cannot be negative
ALTER TABLE "Salary" ADD CONSTRAINT "salary_bonus_check"
  CHECK ("bonus" >= 0);

-- stock: cannot be negative
ALTER TABLE "Salary" ADD CONSTRAINT "salary_stock_check"
  CHECK ("stock" >= 0);

-- total_compensation: must be positive (catches any compute bugs)
ALTER TABLE "Salary" ADD CONSTRAINT "salary_total_compensation_check"
  CHECK ("total_compensation" > 0);