import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CHAPTERS: Array<{ number: number; title: string; description: string }> = [
  { number: 1,  title: "The Scope of Modern Anesthetic Practice", description: "Comprehensive overview of the expanding scope of contemporary anesthesia practice, from fundamental principles to advanced subspecialty procedures." },
  { number: 2,  title: "Anesthesia and Global Health Equity", description: "Global health disparities, the worldwide burden of surgical disease, and the role of the anesthesia provider in improving access to safe care in resource-variable settings." },
  { number: 3,  title: "Perioperative Medicine", description: "Changes in health care delivery and how anesthesiologists coordinate perioperative care, optimize safety, and implement ERAS protocols." },
  { number: 4,  title: "Informatics in Perioperative Medicine", description: "Electronic health records, automated documentation, and clinical decision support systems in perioperative care." },
  { number: 5,  title: "Quality Improvement in Anesthesia Practice and Patient Safety", description: "QI methodologies such as PDSA cycles and Lean Six Sigma to enhance patient safety and system performance." },
  { number: 6,  title: "Human Behavior and Simulation in Anesthesia", description: "Physician well-being, burnout prevention, simulation-based learning and crisis resource management." },
  { number: 7,  title: "Ethical Aspects of Anesthesia Care", description: "Ethical frameworks: informed consent, advance directives, and moral considerations of human and animal research." },
  { number: 8,  title: "Consciousness, Memory, and Anesthesia", description: "Neural basis of consciousness; awareness and unconsciousness; memory formation and amnesia; anesthetic effects on cortical/subcortical networks; intraoperative awareness; relationship between hypnosis, recall, and responsiveness." },
  { number: 9,  title: "Sleep Medicine", description: "Sleep physiology; sleep stages; sleep-disordered breathing; obstructive sleep apnea; perioperative risk in sleep disorders; sedatives/opioids and ventilatory compromise; postoperative monitoring." },
  { number: 10, title: "Cerebral Physiology and the Effects of Anesthetic Drugs", description: "Cerebral blood flow; cerebral metabolic rate; intracranial pressure; autoregulation; blood-brain barrier; anesthetic effects on cerebral perfusion/metabolism; neuroprotection and neurotoxicity concepts." },
  { number: 11, title: "Neuromuscular Physiology and Pharmacology", description: "Neuromuscular junction anatomy; acetylcholine synthesis/release; nicotinic receptors; depolarizing vs nondepolarizing blockade; receptor upregulation; disease states altering neuromuscular transmission; reversal physiology." },
  { number: 12, title: "Respiratory Physiology and Pathophysiology", description: "Lung mechanics; ventilation/perfusion relationships; oxygen and carbon dioxide transport; hypoxic pulmonary vasoconstriction; respiratory failure; effects of anesthesia, positioning, and mechanical ventilation on gas exchange." },
  { number: 13, title: "Cardiac Physiology", description: "Cardiac cycle; ECG-electromechanical correlations; preload, afterload, contractility, heart rate; cardiac output; ventricular function; coronary perfusion; autonomic/humoral regulation." },
  { number: 14, title: "Gastrointestinal and Hepatic Physiology, Pathophysiology, and Anesthetic Considerations", description: "GI motility and aspiration risk; hepatic blood flow; liver anatomy and resections; hepatic metabolism; portal hypertension; liver disease physiology; anesthetic implications of hepatic dysfunction." },
  { number: 15, title: "Renal Anatomy, Physiology, Pharmacology, and Evaluation of Function", description: "Renal anatomy; nephron structure; glomerular filtration; tubular handling of electrolytes/water; renal blood flow; autoregulation; diuretics and renal pharmacology; renal function tests." },
  { number: 16, title: "Basic Principles of Pharmacology", description: "Pharmacokinetics; pharmacodynamics; compartments; clearance; volume of distribution; half-life; context-sensitive decrement; receptor theory; drug interactions; age/disease effects on dosing." },
  { number: 17, title: "Inhaled Anesthetics: Mechanisms of Action", description: "Molecular targets; GABA/glycine enhancement; glutamate inhibition; potassium channels; immobility vs hypnosis vs amnesia; spinal vs supraspinal mechanisms; Meyer-Overton/history of anesthetic theories." },
  { number: 18, title: "Inhaled Anesthetic Uptake, Distribution, Metabolism and Toxicity", description: "Alveolar concentration and partial pressure; blood/gas solubility; uptake and distribution; concentration and second-gas effects; emergence/clearance; hepatic and renal metabolism; halothane hepatitis; fluoride toxicity; compound A; nitrous oxide and B12; environmental effects." },
  { number: 19, title: "Pulmonary Pharmacology of Inhaled Anesthetics", description: "Effects of volatile agents on ventilation; airway smooth muscle; hypoxic pulmonary vasoconstriction; respiratory drive; bronchodilation; pulmonary vascular resistance; anesthetic effects in lung disease." },
  { number: 20, title: "Inhaled Anesthetic Delivery Systems", description: "Anesthesia machines; vaporizers; fresh gas flow; breathing circuits; CO2 absorbents; scavenging; low-flow anesthesia; safety systems; gas monitoring; equipment-related hazards." },
  { number: 21, title: "Intravenous Anesthetics", description: "Propofol; etomidate; ketamine; barbiturates; benzodiazepines; dexmedetomidine; induction and maintenance; pharmacokinetics/dynamics; cardiovascular/respiratory effects; special populations." },
  { number: 22, title: "Opioids", description: "Opioid receptors; morphine, fentanyl, sufentanil, alfentanil, remifentanil, hydromorphone, methadone; analgesia and side effects; respiratory depression; tolerance/hyperalgesia; neuraxial and systemic administration; opioid interactions with hypnotics." },
  { number: 23, title: "Intravenous Drug Delivery Systems", description: "Infusion pumps; target-controlled infusion; pharmacokinetic models; context-sensitive half-time; drug interaction models; propofol-opioid combinations; closed-loop delivery concepts." },
  { number: 24, title: "Pharmacology of Neuromuscular Blocking Drugs and Antagonists (Reversal Agents)", description: "Depolarizing and nondepolarizing blockers; receptor pharmacology; succinylcholine; aminosteroids and benzylisoquinoliniums; organ-independent metabolism; anticholinesterase reversal; sugammadex; residual paralysis." },
  { number: 25, title: "Local Anesthetics", description: "Sodium channel blockade; ester vs amide agents; potency, onset, duration; systemic absorption; toxicity; lipid rescue; additives; differential blockade; regional anesthesia pharmacology." },
  { number: 26, title: "Immune Implications of Anesthesia Care and Practice", description: "Surgery/anesthesia and immune modulation; inflammatory response; tumor surveillance; infection risk; perioperative immunosuppression; anesthetic effects on immune cells; outcomes such as delirium, wound healing, cancer recurrence." },
  { number: 27, title: "Risk of Anesthesia", description: "Anesthesia-related morbidity/mortality; risk stratification; patient, procedure, and system factors; medicolegal and safety data; obstetric and pediatric risk; adverse event prevention." },
  { number: 28, title: "Preoperative Evaluation", description: "Medical history; functional capacity; cardiac risk; pulmonary risk; medications; anticoagulants; pacemakers/ICDs; lab testing; optimization; informed consent; fasting/aspiration assessment." },
  { number: 29, title: "Anesthetic Implications of Concurrent Diseases", description: "Cardiovascular, pulmonary, endocrine, neurologic, renal, hepatic, hematologic, and systemic diseases; perioperative disease optimization; drug-disease interactions; risk mitigation." },
  { number: 30, title: "Patient Positioning and Associated Risks", description: "Supine, prone, lateral, lithotomy, sitting, Trendelenburg; pressure injuries; nerve injuries; ocular injury; compartment syndrome; physiologic effects of positioning; prevention strategies." },
  { number: 31, title: "Neuromuscular Disorders and Other Genetic Disorders", description: "Myasthenia gravis; muscular dystrophies; motor neuron disease; mitochondrial disease; channelopathies; malignant hyperthermia susceptibility; anesthetic drug sensitivity; perioperative respiratory risk." },
  { number: 32, title: "Cardiovascular Monitoring", description: "ECG; arterial pressure; central venous pressure; pulmonary artery catheter; cardiac output monitoring; dynamic indices; ischemia monitoring; invasive vs noninvasive hemodynamic tools." },
  { number: 33, title: "Perioperative Echocardiography and Point-of-Care Ultrasound (POCUS)", description: "TTE/TEE basics; ventricular function; valvular assessment; volume status; pericardial disease; lung ultrasound; gastric ultrasound; vascular access ultrasound; POCUS in shock." },
  { number: 34, title: "Implantable Cardiac Pulse Generators: Pacemakers and Cardioverter-Defibrillators", description: "Pacemaker indications; ICDs; device modes; perioperative interrogation; electromagnetic interference; magnet use; reprogramming; defibrillation and pacing precautions." },
  { number: 35, title: "Neurophysiologic Monitoring", description: "EEG; evoked potentials; somatosensory and motor evoked potentials; electromyography; anesthetic effects on signals; spine/neurosurgery monitoring; ischemia detection." },
  { number: 36, title: "Monitoring the Brain's Response to Anesthesia and Surgery", description: "Processed EEG; depth of anesthesia; burst suppression; awareness prevention; cerebral oximetry; delirium/neurocognitive risk; limitations of brain monitors." },
  { number: 37, title: "Respiratory Monitoring", description: "Pulse oximetry; capnography; airway pressure/flow; spirometry; gas analysis; oxygenation/ventilation assessment; dead space; apnea detection; ventilator monitoring." },
  { number: 38, title: "Renal Pathophysiology and Treatment for Perioperative Ischemia and Nephrotoxic Injury", description: "Acute kidney injury; renal ischemia/reperfusion; risk factors; biomarkers; renal protection; hemodynamic optimization; fluids/vasopressors; nephrotoxic drugs." },
  { number: 39, title: "Neuromuscular Monitoring", description: "Peripheral nerve stimulation; train-of-four; tetanus; posttetanic count; quantitative monitoring; residual blockade; monitoring sites; extubation readiness." },
  { number: 40, title: "Airway Management in the Adult", description: "Airway evaluation; difficult airway algorithms; mask ventilation; supraglottic airways; direct/video laryngoscopy; awake intubation; topical anesthesia; emergency surgical airway; extubation strategy." },
  { number: 41, title: "Spinal, Epidural, and Caudal Anesthesia", description: "Neuraxial anatomy; spinal vs epidural vs caudal techniques; local anesthetic spread; complications; hypotension; post-dural puncture headache; anticoagulation concerns; obstetric/nonobstetric uses." },
  { number: 42, title: "Peripheral Nerve Blocks and Ultrasound Guidance for Regional Anesthesia", description: "Ultrasound physics; needle visualization; upper/lower extremity blocks; fascial plane blocks; catheter techniques; local anesthetic safety; complications and block selection." },
  { number: 43, title: "Perioperative Fluid and Electrolyte Therapy", description: "Crystalloids/colloids; fluid compartments; maintenance vs replacement; goal-directed therapy; sodium, potassium, calcium, magnesium disorders; perioperative hypovolemia/hypervolemia." },
  { number: 44, title: "Perioperative Acid\u2013Base Balance", description: "Metabolic and respiratory acidosis/alkalosis; strong ion concepts; blood gas interpretation; lactate; compensation; ventilatory and renal contributions; intraoperative correction." },
  { number: 45, title: "Patient Blood Management: Transfusion Therapy", description: "RBC transfusion thresholds; plasma, platelets, cryoprecipitate; massive transfusion; transfusion reactions; blood conservation; cell salvage; anemia management." },
  { number: 46, title: "Patient Blood Management: Coagulation", description: "Coagulation cascade; platelet function; anticoagulants; antiplatelet agents; viscoelastic testing; perioperative bleeding; reversal agents; trauma coagulopathy." },
  { number: 47, title: "Management of the Patient with Chronic Pain", description: "Chronic pain assessment; opioid tolerance; opioid-induced hyperalgesia; neuropathic pain; multimodal analgesia; perioperative planning; interventional pain considerations." },
  { number: 48, title: "Palliative Medicine", description: "Goals of care; symptom control; end-of-life communication; high-risk surgery decision-making; pain/dyspnea management; hospice; ethics and shared decision-making." },
  { number: 49, title: "Anesthesia for Thoracic Surgery", description: "One-lung ventilation; double-lumen tubes; bronchial blockers; hypoxemia during OLV; thoracotomy/VATS; lung resection; mediastinal surgery; postoperative analgesia; pulmonary complications." },
  { number: 50, title: "Anesthesia for Cardiac Surgical Procedures", description: "Cardiopulmonary bypass; myocardial protection; CABG; valve surgery; congenital/adult cardiac lesions; anticoagulation; hemodynamic monitoring; separation from bypass." },
  { number: 51, title: "Anesthesia for Correction of Cardiac Arrhythmias", description: "Electrophysiology lab; ablation; arrhythmia mechanisms; anticoagulation; mapping; pacemaker/ICD procedures; hemodynamic instability; sedation vs GA." },
  { number: 52, title: "Anesthesia for Vascular Surgery", description: "Aortic surgery; carotid endarterectomy; peripheral vascular disease; endovascular repair; spinal cord protection; renal protection; anticoagulation; major hemodynamic shifts." },
  { number: 53, title: "Anesthesia for Neurologic Surgery and Neurointerventions", description: "Craniotomy; brain tumor; aneurysm; stroke interventions; intracranial pressure; cerebral perfusion; neurophysiologic monitoring; awake craniotomy; emergence neurologic exam." },
  { number: 54, title: "Anesthesia for Bariatric Surgery", description: "Obesity physiology; OSA; airway issues; dosing in obesity; laparoscopic bariatric procedures; aspiration risk; ventilation strategies; thromboembolism; postoperative respiratory care." },
  { number: 55, title: "Anesthesia and the Renal and Genitourinary Systems", description: "TURP; urologic endoscopy; robotic/prostate surgery; lithotripsy; renal disease considerations; electrolyte disturbances; irrigation fluid complications." },
  { number: 56, title: "Anesthesia for Abdominal Organ Transplantation", description: "Liver, kidney, pancreas and other abdominal transplantation; donor/recipient issues; massive transfusion; reperfusion syndrome; immunosuppression; coagulation; hemodynamic instability." },
  { number: 57, title: "Anesthesia for Organ Procurement", description: "Brain death physiology; donor management; hemodynamic support; endocrine resuscitation; lung/heart/liver/kidney procurement; ethical/logistical issues." },
  { number: 58, title: "Anesthesia for Obstetrics", description: "Maternal physiology; labor analgesia; cesarean anesthesia; neuraxial techniques; obstetric hemorrhage; preeclampsia; difficult airway; fetal considerations; maternal cardiac disease." },
  { number: 59, title: "Anesthesia for Fetal Surgery and Other Fetal Therapies", description: "Maternal-fetal physiology; open fetal surgery; EXIT procedures; uterine relaxation; fetal monitoring/anesthesia; preterm labor prevention; placental/fetal interventions." },
  { number: 60, title: "Anesthesia for Orthopedic Surgery", description: "Regional anesthesia; joint arthroplasty; spine surgery; trauma orthopedics; tourniquets; fat embolism; cement implantation syndrome; positioning; blood loss." },
  { number: 61, title: "Geriatric Anesthesia", description: "Aging physiology; pharmacologic changes; frailty; delirium; cognitive dysfunction; comorbidities; goals of care; postoperative functional recovery." },
  { number: 62, title: "Anesthesia for Trauma", description: "ATLS priorities; airway and hemorrhage control; damage control resuscitation; traumatic brain injury; spine injury; orthopedic trauma timing; coagulopathy; massive transfusion; trauma systems." },
  { number: 63, title: "Prehospital Care for Medical Emergencies and Trauma", description: "EMS systems; airway/resuscitation outside hospital; field triage; hemorrhage control; transport decisions; prehospital analgesia/sedation; disaster interface." },
  { number: 64, title: "Biologic, Natural, and Human-Induced Disasters: The Role of the Anesthesiologist", description: "Disaster preparedness; mass casualty triage; biologic/chemical/radiologic threats; operating room surge capacity; critical care expansion; crisis resource management." },
  { number: 65, title: "Anesthesia for Ophthalmic Surgery", description: "Eye blocks; intraocular pressure; open globe injury; oculocardiac reflex; pediatric eye surgery; cataract/retinal procedures; sedation vs GA." },
  { number: 66, title: "Anesthesia for Otolaryngologic and Head\u2013Neck Surgery", description: "Shared airway; airway tumors; laser surgery/fire risk; thyroid/parathyroid surgery; sinus surgery; tonsillectomy; tracheostomy; nerve monitoring; difficult airway." },
  { number: 67, title: "Anesthesia for Robotic Surgery", description: "Trendelenburg physiology; pneumoperitoneum; remote access to patient; airway/facial edema; positioning injuries; robotic pelvic, thoracic, and abdominal procedures." },
  { number: 68, title: "Ambulatory (Outpatient) Anesthesia", description: "Patient selection; fast-track recovery; PONV prevention; discharge criteria; regional techniques; office-based anesthesia; postoperative pain; safety systems." },
  { number: 69, title: "Non\u2013Operating Room Anesthesia", description: "MRI/CT/PET suites; interventional radiology; endoscopy; cardiac cath/EP labs; remote monitoring; limited access; sedation safety; environmental hazards." },
  { number: 70, title: "Clinical Care in Extreme Environments: Physiology at High Altitude and in Space", description: "Hypobaric hypoxia; acclimatization; altitude illness; anesthesia at altitude; flight transport; space physiology; microgravity; radiation; medical care and anesthesia in space." },
  { number: 71, title: "Clinical Care in Extreme Environments: High Pressure, Immersion, Drowning, Hypo-, and Hyperthermia", description: "Hyperbaric physiology; diving medicine; decompression illness; drowning; immersion effects; high-pressure oxygen; rescue/critical care implications." },
  { number: 72, title: "Pediatric Anesthesia", description: "Pediatric physiology; airway; induction; fluid therapy; congenital disease; neonatal/infant considerations; pharmacology; perioperative respiratory events; pediatric pain." },
  { number: 73, title: "Anesthesia for Pediatric Cardiac Surgery", description: "Congenital heart disease; shunts; cyanotic lesions; cardiopulmonary bypass in children; pulmonary hypertension; single ventricle physiology; postoperative ICU care." },
  { number: 74, title: "Regional Anesthesia in Children", description: "Pediatric neuraxial and peripheral blocks; caudal anesthesia; epidural/spinal techniques; ultrasound guidance; dosing; toxicity prevention; catheter management; contraindications." },
  { number: 75, title: "Pediatric and Neonatal Critical Care", description: "Neonatal/pediatric ICU physiology; respiratory failure; shock; sepsis; congenital heart disease ICU issues; sedation/analgesia; ventilation; ECMO considerations." },
  { number: 76, title: "The Postanesthesia Care Unit", description: "Emergence; airway obstruction; laryngospasm; hypoxemia; pain/PONV; hemodynamic instability; delirium; discharge criteria; postoperative complications." },
  { number: 77, title: "Acute Postoperative Pain", description: "Nociception; central sensitization; preventive/preemptive analgesia; multimodal analgesia; opioids and nonopioids; PCA; epidural/paravertebral analgesia; acute pain services." },
  { number: 78, title: "Perioperative Neurocognitive Disorders", description: "Postoperative delirium; delayed neurocognitive recovery; POCD; risk factors; inflammation; anesthetic depth; elderly vulnerability; screening/prevention." },
  { number: 79, title: "Critical Care Anesthesiology", description: "ICU organ support; shock; ventilation; sepsis; sedation; analgesia; perioperative critical illness; multidisciplinary ICU management." },
  { number: 80, title: "Neurocritical Care", description: "Traumatic brain injury; intracranial hypertension; stroke; subarachnoid hemorrhage; seizures/status epilepticus; cerebral perfusion; neuro-monitoring; ICU sedation." },
  { number: 81, title: "Extracorporeal Membrane Oxygenation and Cardiac Devices", description: "VV/VA ECMO; cannulation; anticoagulation; oxygenator/pump physiology; ventricular assist devices; intra-aortic balloon pump; complications and perioperative management." },
  { number: 82, title: "Cardiopulmonary Resuscitation and Advanced Cardiac Life Support", description: "Cardiac arrest algorithms; defibrillation; airway/ventilation during CPR; vasoactive drugs; reversible causes; post-arrest care; perioperative cardiac arrest." },
  { number: 83, title: "Burn Management", description: "Resuscitation, airway management, and surgical strategies for thermal/electrical burns." },
  { number: 84, title: "Occupational Safety, Infection Control, and Substance Use Disorders", description: "Occupational risks: radiation, infection, and substance use disorders." },
  { number: 85, title: "Emergency Preparedness in Health Care", description: "Facility preparedness, risk mitigation, and response to public health emergencies." },
  { number: 86, title: "Clinical Research", description: "Methodologies, ethics, and statistics for clinical research and trials." },
  { number: 87, title: "Interpreting the Medical Literature", description: "Critical evaluation of published medical literature for evidence-based decisions." },
];

const SITE_CONTENT: Array<{ key: string; value: string }> = [
  {
    key: "about_pearl",
    value: `לאחר שנשללו ממנה כל המכשור הרפואי וחומרי ההרדמה, ד"ר פרל סיכנה את חייה כדי לבצע ניתוחים בחשאי כשהיא נעזרת בלחישות, באחיזת ידיים ובחמלה עמוקה בלבד כדי ללוות את מטופלותיה מבעד לכאבים מייסרים.

קראנו לפלטפורמה זו על שמה כדי לזכור שאלחוש והרדמה הם הרבה מעבר לפרמקולוגיה ופיזיולוגיה.`,
  },
  {
    key: "about_yoni",
    value: `ד"ר יוני חלאטניק  הוא רופא מרדים ומפתח פלטפורמת Perl.

Yonatan@khalatnik.com`,
  },
  {
    key: "about_daniel",
    value: `ד"ר דניאל רון אילוז הוא רופא מרדים ומפתח פלטפורמת Perl.`,
  },
];

async function main() {
  for (const c of CHAPTERS) {
    await prisma.chapter.upsert({
      where: { number: c.number },
      update: { title: c.title, description: c.description },
      create: c,
    });
  }
  console.log(`Seeded ${CHAPTERS.length} chapters.`);

  for (const sc of SITE_CONTENT) {
    await prisma.siteContent.upsert({
      where: { key: sc.key },
      update: {},
      create: sc,
    });
  }
  console.log(`Seeded ${SITE_CONTENT.length} site content entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
