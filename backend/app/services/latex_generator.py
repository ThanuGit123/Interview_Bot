import structlog
import json
from typing import Dict, Any
from app.core.llm import get_llm
from app.db.client import get_db
from langchain_core.messages import HumanMessage

logger = structlog.get_logger(__name__)

async def generate_latex_resume(resume_id: str, user_id: str, role: str = None) -> str:
    db = get_db()
    
    # Fetch the resume document
    resume = db.resumes.find_one({"_id": resume_id, "user_id": user_id})
    if not resume:
        raise ValueError("Resume not found")

    # If latex resume was already generated, return it
    # if "latex_resume" in resume and resume["latex_resume"]:
    #    return resume["latex_resume"]

    resume_text = resume.get("extracted_text", "")
    
    if not resume_text:
        raise ValueError("Resume text is empty. Cannot generate LaTeX resume.")

    # CASCADE DEPENDENCY: Always ensure the ATS Report is generated for the specific role
    from app.services.ats_report import generate_ats_report
    ats_report = await generate_ats_report(resume_id, user_id, role)

    llm = get_llm()

    LATEX_TEMPLATE = r"""\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-0.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

\begin{document}

% --- HEADER ---
% Format: \textbf{\Huge First Last} \\ \vspace{1pt}
% Contact Info...

% --- EDUCATION ---
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {University Name}{City, State}
      {Degree Name}{Month Year}
  \resumeSubHeadingListEnd

% --- EXPERIENCE ---
\section{Experience}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Company Name}{Month Year -- Month Year}
      {Job Title}{City, State}
      \resumeItemListStart
        \resumeItem{Bullet point 1...}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

% --- PROJECTS ---
\section{Projects}
  \resumeSubHeadingListStart
    \resumeProjectHeading
      {\textbf{Project Name} $|$ \emph{Tech Stack}}{Month Year}
      \resumeItemListStart
        \resumeItem{Bullet point...}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

% --- TECHNICAL SKILLS ---
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: ...} \\
     \textbf{Frameworks}{: ...} \\
     \textbf{Tools}{: ...}
    }}
 \end{itemize}

\end{document}
"""

    prompt_str = f"""
You are an elite Resume Writer and LaTeX Expert.
Your task is to completely rewrite and format the candidate's raw resume into a professional, compile-ready LaTeX document.
You must incorporate the improvements from the provided ATS Analysis (add missing keywords naturally, fix weaknesses, and use the improved bullet points).

CANDIDATE'S ORIGINAL RAW RESUME:
{resume_text[:15000]}

ATS ANALYSIS FEEDBACK TO INCORPORATE:
{json.dumps(ats_report)[:5000]}

REQUIREMENTS:
1. You MUST use the exact preamble and custom macros provided in the template below. DO NOT change the preamble.
2. Use \resumeSubheading for Education and Experience, and \resumeProjectHeading for Projects.
3. Use \resumeItemListStart and \resumeItem{{}} for bullet points.
4. ONLY output the raw LaTeX code starting with \documentclass and ending with \end{{document}}.

=== REQUIRED LATEX TEMPLATE TO USE ===
{LATEX_TEMPLATE}
=== END LATEX TEMPLATE ===

Fill in the template completely with the candidate's actual enhanced data. Do NOT output anything except the LaTeX code.
"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt_str)])
        content = response.content
        
        # Clean up markdown formatting if the model adds markdown code blocks
        if "```latex" in content:
            content = content.split("```latex")[1].split("```")[0].strip()
        elif "```tex" in content:
            content = content.split("```tex")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        content = content.strip()
        
        # Cache the report in the database so we don't have to generate it again
        db.resumes.update_one(
            {"_id": resume_id, "user_id": user_id},
            {"$set": {"latex_resume": content}}
        )
        
        return content

    except Exception as e:
        logger.error("latex_generation_failed", error=str(e))
        raise ValueError("Failed to generate LaTeX resume")
