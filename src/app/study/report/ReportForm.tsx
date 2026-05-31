"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitDebugReport } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, MessageSquare, AlertTriangle } from "lucide-react";

type Kind = "BUG" | "FEEDBACK" | "TECHNICAL";

type ReportDictionary = {
  kindLabel: string;
  kindBug: string;
  kindBugDesc: string;
  kindFeedback: string;
  kindFeedbackDesc: string;
  kindTechnical: string;
  kindTechnicalDesc: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  categoryWrongAnswer: string;
  categoryTypo: string;
  categoryUi: string;
  categoryOther: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  descriptionHint: string;
  chapterLabel: string;
  questionIdLabel: string;
  pageUrlLabel: string;
  pageUrlAuto: string;
  contactEmailLabel: string;
  submit: string;
  submitting: string;
};

const KIND_ICONS = {
  BUG: Bug,
  FEEDBACK: MessageSquare,
  TECHNICAL: AlertTriangle,
} as const;

function SubmitButton({ labels }: { labels: { submit: string; submitting: string } }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? labels.submitting : labels.submit}
    </Button>
  );
}

export function ReportForm({
  defaultEmail,
  t,
}: {
  defaultEmail: string;
  t: ReportDictionary;
}) {
  const [kind, setKind] = useState<Kind>("BUG");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    setPageUrl(referrer || (typeof window !== "undefined" ? window.location.href : ""));
  }, []);

  const kindOptions: Array<{ value: Kind; label: string; desc: string }> = [
    { value: "BUG", label: t.kindBug, desc: t.kindBugDesc },
    { value: "FEEDBACK", label: t.kindFeedback, desc: t.kindFeedbackDesc },
    { value: "TECHNICAL", label: t.kindTechnical, desc: t.kindTechnicalDesc },
  ];

  return (
    <form action={submitDebugReport} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t.kindLabel}</Label>
        <RadioGroup
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
          name="kind"
          className="grid gap-3 sm:grid-cols-3"
        >
          {kindOptions.map((opt) => {
            const Icon = KIND_ICONS[opt.value];
            const active = kind === opt.value;
            return (
              <label
                key={opt.value}
                htmlFor={`kind-${opt.value}`}
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <RadioGroupItem value={opt.value} id={`kind-${opt.value}`} />
                </div>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      {kind === "BUG" && (
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-semibold">
            {t.categoryLabel}
          </Label>
          <Select name="category">
            <SelectTrigger id="category">
              <SelectValue placeholder={t.categoryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wrong-answer">{t.categoryWrongAnswer}</SelectItem>
              <SelectItem value="typo">{t.categoryTypo}</SelectItem>
              <SelectItem value="ui">{t.categoryUi}</SelectItem>
              <SelectItem value="other">{t.categoryOther}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold">
          {t.descriptionLabel}
        </Label>
        <Textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder={t.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t.descriptionHint} · {description.length}/4000
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="chapterNumber" className="text-sm font-medium">
            {t.chapterLabel}
          </Label>
          <Input
            id="chapterNumber"
            name="chapterNumber"
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="questionId" className="text-sm font-medium">
            {t.questionIdLabel}
          </Label>
          <Input
            id="questionId"
            name="questionId"
            type="number"
            min={1}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail" className="text-sm font-medium">
          {t.contactEmailLabel}
        </Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={defaultEmail}
          maxLength={320}
        />
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-3 space-y-1">
          <Label htmlFor="pageUrl" className="text-xs font-medium text-muted-foreground">
            {t.pageUrlLabel} · {t.pageUrlAuto}
          </Label>
          <Input
            id="pageUrl"
            name="pageUrl"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            className="text-xs"
          />
        </CardContent>
      </Card>

      <SubmitButton labels={{ submit: t.submit, submitting: t.submitting }} />
    </form>
  );
}
