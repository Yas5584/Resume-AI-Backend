import {
  AIProvider,
  AIModelInfo,
  StructuredOutputParams,
  AIStructuredResponse,
  TextGenerationParams,
  AITextResponse,
} from "./ai-provider.interface.js";
import { parseResumeFromText } from "../parsers/deterministic-resume-parser.js";
import {
  DEFAULT_PRESERVATION_RULES,
  DEFAULT_PROHIBITED_CHANGES,
  RESUME_STRATEGY_VERSION,
} from "@resumeai/shared";

export class MockAIProvider implements AIProvider {
  private model: string;

  constructor(model = "mock-llm-v1") {
    this.model = model;
  }

  getModelInfo(): AIModelInfo {
    return {
      provider: "mock",
      modelName: this.model,
      maxContextTokens: 32000,
      costPer1kInputTokensUsd: 0.0,
      costPer1kOutputTokensUsd: 0.0,
    };
  }

  async generateStructuredOutput<T>(
    params: StructuredOutputParams<T>,
  ): Promise<AIStructuredResponse<T>> {
    let mockData: unknown;

    switch (params.schemaName) {
      case "JobAnalysisSchema": {
        const promptLower = (params.prompt || "").toLowerCase();

        if (
          promptLower.includes("ignore") &&
          (promptLower.includes("instruction") || promptLower.includes("admin"))
        ) {
          // Prompt injection defense fixture: treated strictly as passive data
          mockData = {
            jobTitle: "Software Developer",
            company: null,
            seniority: "UNKNOWN",
            summary: "Software development role extracted from job posting.",
            responsibilities: [
              {
                text: "Develop software solutions",
                importance: "REQUIRED",
                evidence: "develop software",
                confidence: 0.9,
              },
            ],
            requirements: [
              {
                text: "Knowledge of software engineering",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "software engineering",
                confidence: 0.9,
              },
            ],
            skills: [
              {
                name: "JavaScript",
                normalizedName: "JavaScript",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "JavaScript",
                confidence: 0.9,
              },
            ],
            education: [],
            certifications: [],
            experience: [],
            keywords: [
              {
                keyword: "JavaScript",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 1,
                evidence: "JavaScript",
                confidence: 0.9,
              },
            ],
            workArrangement: "UNKNOWN",
            location: null,
            industry: null,
            workAuthorization: null,
            roleSummary:
              "Software development role extracted from job posting.",
            requiredSkills: ["JavaScript"],
            preferredSkills: [],
            coreResponsibilities: ["Develop software solutions"],
            domainKeywords: ["JavaScript"],
            seniorityLevel: "UNKNOWN",
            experienceYearsMinimum: 0,
          };
        } else if (
          promptLower.includes("not required") ||
          promptLower.includes("graphql")
        ) {
          // Negation handling fixture: GraphQL is NOT required, Docker is preferred/plus
          mockData = {
            jobTitle: "Full Stack Developer",
            company: "Innovate Inc",
            seniority: "MID_LEVEL",
            summary:
              "Full stack web developer. React and Node.js required. Experience with GraphQL is NOT required. Docker is a plus, but not required.",
            responsibilities: [
              {
                text: "Build web applications",
                importance: "REQUIRED",
                evidence: "Build web applications",
                confidence: 0.95,
              },
            ],
            requirements: [
              {
                text: "React experience",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "React required",
                confidence: 0.98,
              },
              {
                text: "Node.js experience",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Node.js required",
                confidence: 0.98,
              },
              {
                text: "GraphQL experience",
                category: "PREFERRED_SKILL",
                importance: "NICE_TO_HAVE",
                explicit: true,
                evidence: "Experience with GraphQL is NOT required",
                confidence: 0.95,
              },
              {
                text: "Docker experience",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Docker is a plus, but not required",
                confidence: 0.95,
              },
            ],
            skills: [
              {
                name: "React",
                normalizedName: "React",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "React required",
                confidence: 0.98,
              },
              {
                name: "Node.js",
                normalizedName: "Node.js",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Node.js required",
                confidence: 0.98,
              },
              {
                name: "GraphQL",
                normalizedName: "GraphQL",
                category: "PREFERRED_SKILL",
                importance: "NICE_TO_HAVE",
                explicit: true,
                evidence: "Experience with GraphQL is NOT required",
                confidence: 0.95,
              },
              {
                name: "Docker",
                normalizedName: "Docker",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Docker is a plus, but not required",
                confidence: 0.95,
              },
            ],
            education: [],
            certifications: [],
            experience: [
              {
                yearsMin: 3,
                yearsMax: null,
                domain: "web development",
                management: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "3+ years web development",
                confidence: 0.95,
              },
            ],
            keywords: [
              {
                keyword: "React",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "React",
                confidence: 0.98,
              },
              {
                keyword: "Node.js",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Node.js",
                confidence: 0.98,
              },
              {
                keyword: "GraphQL",
                category: "TECHNICAL",
                importance: "NICE_TO_HAVE",
                frequency: 1,
                evidence: "GraphQL",
                confidence: 0.95,
              },
              {
                keyword: "Docker",
                category: "TOOL",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "Docker",
                confidence: 0.95,
              },
            ],
            workArrangement: "REMOTE",
            location: "Remote",
            industry: "Technology",
            workAuthorization: null,
            roleSummary:
              "Full stack web developer role with React and Node.js.",
            requiredSkills: ["React", "Node.js"],
            preferredSkills: ["GraphQL", "Docker"],
            coreResponsibilities: ["Build web applications"],
            domainKeywords: ["React", "Node.js", "Docker"],
            seniorityLevel: "MID_LEVEL",
            experienceYearsMinimum: 3,
          };
        } else if (
          promptLower.includes("react or vue") ||
          promptLower.includes("techfrontend")
        ) {
          // Conditional OR/AND fixture
          mockData = {
            jobTitle: "Frontend Engineer",
            company: "TechFrontend",
            seniority: "MID_LEVEL",
            summary:
              "Frontend engineer with React OR Vue, and TypeScript required.",
            responsibilities: [
              {
                text: "Develop frontend web applications",
                importance: "REQUIRED",
                evidence: "Develop frontend web applications",
                confidence: 0.95,
              },
            ],
            requirements: [
              {
                text: "Experience with React or Vue",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Experience with React or Vue",
                confidence: 0.95,
                relationship: "OR",
                relatedRequirements: ["React", "Vue"],
              },
              {
                text: "React and TypeScript experience",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "React and TypeScript",
                confidence: 0.95,
                relationship: "AND",
                relatedRequirements: ["React", "TypeScript"],
              },
            ],
            skills: [
              {
                name: "React",
                normalizedName: "React",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "React or Vue",
                confidence: 0.95,
              },
              {
                name: "Vue",
                normalizedName: "Vue.js",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "React or Vue",
                confidence: 0.9,
              },
              {
                name: "TypeScript",
                normalizedName: "TypeScript",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "TypeScript",
                confidence: 0.95,
              },
            ],
            education: [],
            certifications: [],
            experience: [
              {
                yearsMin: 3,
                yearsMax: null,
                domain: "frontend",
                management: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "3+ years frontend experience",
                confidence: 0.9,
              },
            ],
            keywords: [
              {
                keyword: "React",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "React",
                confidence: 0.95,
              },
              {
                keyword: "Vue",
                category: "TECHNICAL",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "Vue",
                confidence: 0.9,
              },
              {
                keyword: "TypeScript",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "TypeScript",
                confidence: 0.95,
              },
            ],
            workArrangement: "HYBRID",
            location: "Austin, TX",
            industry: "Software",
            workAuthorization: null,
            roleSummary: "Frontend engineer working with React or Vue.",
            requiredSkills: ["React", "TypeScript"],
            preferredSkills: ["Vue.js"],
            coreResponsibilities: ["Develop frontend web applications"],
            domainKeywords: ["React", "Vue", "TypeScript"],
            seniorityLevel: "MID_LEVEL",
            experienceYearsMinimum: 3,
          };
        } else if (
          promptLower.includes("data analyst") ||
          promptLower.includes("dataworks")
        ) {
          // Data Analyst fixture
          mockData = {
            jobTitle: "Data Analyst",
            company: "DataWorks",
            seniority: "MID_LEVEL",
            summary:
              "Data analyst analyzing business metrics and building dashboards.",
            responsibilities: [
              {
                text: "Analyze large datasets and generate business insights",
                importance: "REQUIRED",
                evidence: "Analyze large datasets",
                confidence: 0.95,
              },
              {
                text: "Design and maintain reporting dashboards",
                importance: "REQUIRED",
                evidence: "maintain reporting dashboards",
                confidence: 0.92,
              },
            ],
            requirements: [
              {
                text: "Proficiency in SQL",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "SQL required",
                confidence: 0.98,
              },
              {
                text: "Advanced Excel skills",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Excel required",
                confidence: 0.95,
              },
              {
                text: "Python for data analysis",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Python required",
                confidence: 0.92,
              },
              {
                text: "Tableau experience preferred",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Tableau preferred",
                confidence: 0.9,
              },
              {
                text: "Power BI experience is a plus",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Power BI is a plus",
                confidence: 0.88,
              },
            ],
            skills: [
              {
                name: "SQL",
                normalizedName: "SQL",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "SQL required",
                confidence: 0.98,
              },
              {
                name: "Excel",
                normalizedName: "Excel",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Excel required",
                confidence: 0.95,
              },
              {
                name: "Python",
                normalizedName: "Python",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Python required",
                confidence: 0.92,
              },
              {
                name: "Tableau",
                normalizedName: "Tableau",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Tableau preferred",
                confidence: 0.9,
              },
              {
                name: "Power BI",
                normalizedName: "Power BI",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Power BI is a plus",
                confidence: 0.88,
              },
            ],
            education: [
              {
                degree: "Bachelor's",
                field: "Statistics or Mathematics",
                minimum: true,
                preferred: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "Bachelor's in Statistics or Math",
                confidence: 0.9,
              },
            ],
            certifications: [],
            experience: [
              {
                yearsMin: 2,
                yearsMax: 4,
                domain: "data analysis",
                management: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "2-4 years of data analysis experience",
                confidence: 0.95,
              },
            ],
            keywords: [
              {
                keyword: "SQL",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 5,
                evidence: "SQL",
                confidence: 0.98,
              },
              {
                keyword: "Excel",
                category: "TOOL",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "Excel",
                confidence: 0.95,
              },
              {
                keyword: "Python",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Python",
                confidence: 0.92,
              },
              {
                keyword: "Tableau",
                category: "TOOL",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "Tableau",
                confidence: 0.9,
              },
              {
                keyword: "Power BI",
                category: "TOOL",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "Power BI",
                confidence: 0.88,
              },
            ],
            workArrangement: "HYBRID",
            location: "Chicago, IL",
            industry: "Analytics",
            workAuthorization: null,
            roleSummary:
              "Data analyst analyzing business metrics and building dashboards.",
            requiredSkills: ["SQL", "Excel", "Python"],
            preferredSkills: ["Tableau", "Power BI"],
            coreResponsibilities: [
              "Analyze large datasets and generate business insights",
            ],
            domainKeywords: ["SQL", "Excel", "Python", "Tableau", "Power BI"],
            seniorityLevel: "MID_LEVEL",
            experienceYearsMinimum: 2,
          };
        } else if (
          promptLower.includes("designer") ||
          promptLower.includes("figma")
        ) {
          // Designer fixture
          mockData = {
            jobTitle: "Product Designer",
            company: "DesignCo",
            seniority: "MID_LEVEL",
            summary:
              "Product designer conducting UX research and crafting high-fidelity UI design.",
            responsibilities: [
              {
                text: "Design end-to-end user journeys and prototypes",
                importance: "REQUIRED",
                evidence: "Design end-to-end user journeys",
                confidence: 0.95,
              },
              {
                text: "Conduct user research and usability testing",
                importance: "REQUIRED",
                evidence: "Conduct user research",
                confidence: 0.92,
              },
            ],
            requirements: [
              {
                text: "Expertise in Figma",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Figma required",
                confidence: 0.98,
              },
              {
                text: "UX research experience",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "UX research required",
                confidence: 0.95,
              },
              {
                text: "UI design proficiency",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "UI design required",
                confidence: 0.95,
              },
            ],
            skills: [
              {
                name: "Figma",
                normalizedName: "Figma",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Figma required",
                confidence: 0.98,
              },
              {
                name: "UX research",
                normalizedName: "UX Research",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "UX research required",
                confidence: 0.95,
              },
              {
                name: "UI design",
                normalizedName: "UI Design",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "UI design required",
                confidence: 0.95,
              },
            ],
            education: [],
            certifications: [],
            experience: [
              {
                yearsMin: 3,
                yearsMax: null,
                domain: "product design",
                management: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "3+ years product design experience",
                confidence: 0.95,
              },
            ],
            keywords: [
              {
                keyword: "Figma",
                category: "TOOL",
                importance: "REQUIRED",
                frequency: 4,
                evidence: "Figma",
                confidence: 0.98,
              },
              {
                keyword: "UX research",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "UX research",
                confidence: 0.95,
              },
              {
                keyword: "UI design",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "UI design",
                confidence: 0.95,
              },
            ],
            workArrangement: "REMOTE",
            location: "Remote",
            industry: "Design",
            workAuthorization: null,
            roleSummary:
              "Product designer crafting UI/UX experiences in Figma.",
            requiredSkills: ["Figma", "UX Research", "UI Design"],
            preferredSkills: [],
            coreResponsibilities: [
              "Design end-to-end user journeys and prototypes",
            ],
            domainKeywords: ["Figma", "UX research", "UI design"],
            seniorityLevel: "MID_LEVEL",
            experienceYearsMinimum: 3,
          };
        } else if (
          promptLower.includes("engineering manager") ||
          promptLower.includes("enterprisecorp")
        ) {
          // Manager fixture
          mockData = {
            jobTitle: "Engineering Manager",
            company: "EnterpriseCorp",
            seniority: "MANAGER",
            summary:
              "Engineering manager leading software teams and stakeholder communication.",
            responsibilities: [
              {
                text: "Lead, mentor, and grow a team of software engineers",
                importance: "REQUIRED",
                evidence: "Lead and mentor software engineers",
                confidence: 0.95,
              },
              {
                text: "Manage roadmap execution and stakeholder alignment",
                importance: "REQUIRED",
                evidence: "Manage roadmap execution",
                confidence: 0.95,
              },
            ],
            requirements: [
              {
                text: "Demonstrated team leadership experience",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "team leadership required",
                confidence: 0.98,
              },
              {
                text: "Stakeholder management capabilities",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "stakeholder management required",
                confidence: 0.95,
              },
              {
                text: "5+ years of software experience",
                category: "EXPERIENCE",
                importance: "REQUIRED",
                explicit: true,
                evidence: "5+ years experience required",
                confidence: 0.98,
              },
            ],
            skills: [
              {
                name: "team leadership",
                normalizedName: "Team Leadership",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "team leadership required",
                confidence: 0.98,
              },
              {
                name: "stakeholder management",
                normalizedName: "Stakeholder Management",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "stakeholder management required",
                confidence: 0.95,
              },
            ],
            education: [],
            certifications: [],
            experience: [
              {
                yearsMin: 5,
                yearsMax: null,
                domain: "engineering management",
                management: true,
                importance: "REQUIRED",
                explicit: true,
                evidence: "5+ years experience required",
                confidence: 0.98,
              },
            ],
            keywords: [
              {
                keyword: "team leadership",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "team leadership",
                confidence: 0.98,
              },
              {
                keyword: "stakeholder management",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "stakeholder management",
                confidence: 0.95,
              },
            ],
            workArrangement: "ONSITE",
            location: "New York, NY",
            industry: "Enterprise",
            workAuthorization: null,
            roleSummary:
              "Engineering manager leading teams and managing stakeholders.",
            requiredSkills: ["Team Leadership", "Stakeholder Management"],
            preferredSkills: [],
            coreResponsibilities: [
              "Lead, mentor, and grow a team of software engineers",
            ],
            domainKeywords: ["team leadership", "stakeholder management"],
            seniorityLevel: "MANAGER",
            experienceYearsMinimum: 5,
          };
        } else if (
          promptLower.includes("ambiguous") ||
          promptLower.includes("vague")
        ) {
          // Ambiguous JD: does NOT hallucinate company or seniority
          mockData = {
            jobTitle: "Team Member",
            company: null,
            seniority: "UNKNOWN",
            summary: "Join our dynamic team for exciting opportunities.",
            responsibilities: [
              {
                text: "Collaborate with team members",
                importance: "REQUIRED",
                evidence: "collaborate with team",
                confidence: 0.8,
              },
            ],
            requirements: [
              {
                text: "Good communication skills",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "communication skills",
                confidence: 0.85,
              },
            ],
            skills: [
              {
                name: "communication",
                normalizedName: "Communication",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "communication skills",
                confidence: 0.85,
              },
            ],
            education: [],
            certifications: [],
            experience: [],
            keywords: [
              {
                keyword: "communication",
                category: "SOFT_SKILL",
                importance: "REQUIRED",
                frequency: 1,
                evidence: "communication",
                confidence: 0.85,
              },
            ],
            workArrangement: "UNKNOWN",
            location: null,
            industry: null,
            workAuthorization: null,
            roleSummary: "Join our dynamic team for exciting opportunities.",
            requiredSkills: ["Communication"],
            preferredSkills: [],
            coreResponsibilities: ["Collaborate with team members"],
            domainKeywords: ["communication"],
            seniorityLevel: "UNKNOWN",
            experienceYearsMinimum: 0,
          };
        } else if (
          promptLower.includes("data scientist") ||
          promptLower.includes("databricks") ||
          promptLower.includes("atain") ||
          promptLower.includes("pyspark")
        ) {
          // Data Scientist fixture (Phase 7 accuracy)
          mockData = {
            jobTitle: "Data Scientist",
            company: "Atain",
            seniority: "SENIOR",
            summary:
              "Data Scientist with 7+ years of hands-on experience in traditional AI, machine learning, advanced analytics, and statistical modeling. Developing and deploying analytical models using Python and SQL, with experience working on large-scale datasets in Databricks.",
            responsibilities: [
              {
                text: "Develop and implement advanced machine learning and statistical models for business problems",
                importance: "REQUIRED",
                evidence:
                  "Develop and implement advanced machine learning and statistical models",
                confidence: 0.95,
              },
              {
                text: "Build solutions using forecasting, optimization, clustering, regression, and recommendation models",
                importance: "REQUIRED",
                evidence:
                  "Build solutions using forecasting, optimization, clustering, regression, and recommendation models",
                confidence: 0.95,
              },
              {
                text: "Perform statistical analysis, hypothesis testing, feature engineering, and exploratory data analysis",
                importance: "REQUIRED",
                evidence:
                  "Perform statistical analysis, hypothesis testing, feature engineering",
                confidence: 0.95,
              },
              {
                text: "Work with large and complex datasets using Databricks, SQL, and Python",
                importance: "REQUIRED",
                evidence:
                  "Work with large and complex datasets using Databricks, SQL, and Python",
                confidence: 0.95,
              },
              {
                text: "Develop predictive and prescriptive analytics solutions to support business decision-making",
                importance: "REQUIRED",
                evidence:
                  "Develop predictive and prescriptive analytics solutions",
                confidence: 0.92,
              },
              {
                text: "Architect scalable backend services and microservices",
                importance: "REQUIRED",
                evidence:
                  "Architect scalable backend services and microservices",
                confidence: 0.9,
              },
            ],
            requirements: [
              {
                text: "7+ years of experience in Data Science, Machine Learning, Advanced Analytics, or a related field",
                category: "EXPERIENCE",
                importance: "REQUIRED",
                explicit: true,
                evidence:
                  "7+ years of experience in Data Science, Machine Learning",
                confidence: 0.98,
              },
              {
                text: "Hands-on experience with Databricks and distributed data processing",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence:
                  "Hands-on experience with Databricks and distributed data processing",
                confidence: 0.95,
              },
              {
                text: "Forecasting / Time-Series Modeling",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Forecasting / Time-Series Modeling",
                confidence: 0.95,
              },
              {
                text: "Optimization Techniques",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Optimization Techniques",
                confidence: 0.95,
              },
              {
                text: "Clustering",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Clustering",
                confidence: 0.95,
              },
              {
                text: "Regression",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Regression",
                confidence: 0.95,
              },
              {
                text: "Recommendation Systems",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Recommendation Systems",
                confidence: 0.95,
              },
              {
                text: "Apache Spark / PySpark",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Experience with Apache Spark / PySpark",
                confidence: 0.9,
              },
            ],
            skills: [
              {
                name: "Python",
                normalizedName: "Python",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Strong proficiency in Python",
                confidence: 0.98,
              },
              {
                name: "SQL",
                normalizedName: "SQL",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Strong proficiency in SQL",
                confidence: 0.98,
              },
              {
                name: "Databricks",
                normalizedName: "Databricks",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Hands-on experience with Databricks",
                confidence: 0.95,
              },
              {
                name: "Machine Learning",
                normalizedName: "Machine Learning",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence:
                  "7+ years of experience in Data Science, Machine Learning",
                confidence: 0.98,
              },
              {
                name: "Traditional AI",
                normalizedName: "Traditional AI",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "experience in traditional AI",
                confidence: 0.92,
              },
              {
                name: "Forecasting",
                normalizedName: "Forecasting",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Forecasting / Time-Series Modeling",
                confidence: 0.95,
              },
              {
                name: "Optimization",
                normalizedName: "Optimization",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Optimization Techniques",
                confidence: 0.95,
              },
              {
                name: "Clustering",
                normalizedName: "Clustering",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Clustering",
                confidence: 0.95,
              },
              {
                name: "Regression",
                normalizedName: "Regression",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Regression",
                confidence: 0.95,
              },
              {
                name: "Recommendation Systems",
                normalizedName: "Recommendation Systems",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Recommendation Systems",
                confidence: 0.95,
              },
              {
                name: "Statistical Analysis",
                normalizedName: "Statistical Analysis",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Statistical Analysis",
                confidence: 0.95,
              },
              {
                name: "Predictive Modeling",
                normalizedName: "Predictive Modeling",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Predictive Modeling",
                confidence: 0.95,
              },
              {
                name: "Apache Spark",
                normalizedName: "Apache Spark",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Experience with Apache Spark / PySpark",
                confidence: 0.9,
              },
              {
                name: "PySpark",
                normalizedName: "PySpark",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Experience with Apache Spark / PySpark",
                confidence: 0.9,
              },
              {
                name: "Scikit-learn",
                normalizedName: "Scikit-learn",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "ML libraries such as Scikit-learn",
                confidence: 0.92,
              },
              {
                name: "TensorFlow",
                normalizedName: "TensorFlow",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "ML libraries such as TensorFlow",
                confidence: 0.92,
              },
              {
                name: "XGBoost",
                normalizedName: "XGBoost",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "ML libraries such as XGBoost",
                confidence: 0.9,
              },
              {
                name: "MLOps",
                normalizedName: "MLOps",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Knowledge of MLOps",
                confidence: 0.88,
              },
            ],
            education: [
              {
                degree: "Bachelor's or Master's",
                field:
                  "Computer Science, Data Science, Statistics, Mathematics",
                minimum: true,
                preferred: false,
                importance: "REQUIRED",
                explicit: true,
                evidence:
                  "Bachelor's or Master's degree in CS, DS, Stats, Math",
                confidence: 0.95,
              },
            ],
            certifications: [],
            experience: [
              {
                yearsMin: 7,
                yearsMax: null,
                domain: "Data Science, Machine Learning",
                management: false,
                importance: "REQUIRED",
                explicit: true,
                evidence:
                  "7+ years of experience in Data Science, Machine Learning",
                confidence: 0.98,
              },
            ],
            keywords: [
              {
                keyword: "Python",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 4,
                evidence: "Python",
                confidence: 0.98,
              },
              {
                keyword: "SQL",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "SQL",
                confidence: 0.98,
              },
              {
                keyword: "Databricks",
                category: "PLATFORM",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "Databricks",
                confidence: 0.95,
              },
              {
                keyword: "Machine Learning",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 4,
                evidence: "Machine Learning",
                confidence: 0.98,
              },
              {
                keyword: "Forecasting",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Forecasting",
                confidence: 0.95,
              },
              {
                keyword: "Optimization",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Optimization",
                confidence: 0.95,
              },
              {
                keyword: "Regression",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Regression",
                confidence: 0.95,
              },
              {
                keyword: "Clustering",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Clustering",
                confidence: 0.95,
              },
              {
                keyword: "Recommendation Systems",
                category: "DOMAIN",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Recommendation Systems",
                confidence: 0.95,
              },
              {
                keyword: "PySpark",
                category: "TOOL",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "PySpark",
                confidence: 0.9,
              },
            ],
            workArrangement: "REMOTE",
            location: "Remote – India",
            industry: "Technology",
            workAuthorization: null,
            roleSummary:
              "Data Scientist with 7+ years hands-on experience in machine learning and Databricks.",
            requiredSkills: [
              "Python",
              "SQL",
              "Databricks",
              "Machine Learning",
              "Traditional AI",
              "Forecasting",
              "Optimization",
              "Clustering",
              "Regression",
              "Recommendation Systems",
              "Statistical Analysis",
              "Predictive Modeling",
            ],
            preferredSkills: [
              "Apache Spark",
              "PySpark",
              "Scikit-learn",
              "TensorFlow",
              "XGBoost",
              "MLOps",
            ],
            coreResponsibilities: [
              "Develop and implement advanced machine learning and statistical models",
              "Build solutions using forecasting, optimization, clustering, regression, and recommendation models",
            ],
            domainKeywords: [
              "Python",
              "SQL",
              "Databricks",
              "Machine Learning",
              "Forecasting",
              "Optimization",
              "Regression",
              "Clustering",
            ],
            seniorityLevel: "SENIOR",
            experienceYearsMinimum: 7,
          };
        } else {
          // Default: Senior Software Engineer
          mockData = {
            jobTitle: "Senior Software Engineer",
            company: "Tech Corp",
            seniority: "SENIOR",
            summary:
              "Lead development of full-stack web applications using React, TypeScript, Node.js, and PostgreSQL.",
            responsibilities: [
              {
                text: "Architect scalable backend services and microservices",
                importance: "REQUIRED",
                evidence: "Architect scalable backend services",
                confidence: 0.95,
              },
              {
                text: "Develop responsive frontend web applications",
                importance: "REQUIRED",
                evidence: "Develop responsive frontend web applications",
                confidence: 0.95,
              },
              {
                text: "Design and maintain relational database schemas",
                importance: "REQUIRED",
                evidence: "maintain relational database schemas",
                confidence: 0.92,
              },
              {
                text: "Mentor junior engineers on engineering best practices",
                importance: "REQUIRED",
                evidence: "Mentor junior engineers",
                confidence: 0.9,
              },
            ],
            requirements: [
              {
                text: "Proficiency in JavaScript and TypeScript",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "JavaScript and TypeScript required",
                confidence: 0.98,
              },
              {
                text: "Hands-on experience with React",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "React required",
                confidence: 0.98,
              },
              {
                text: "Backend development with Node.js",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Node.js required",
                confidence: 0.98,
              },
              {
                text: "PostgreSQL database experience",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "PostgreSQL experience required",
                confidence: 0.95,
              },
              {
                text: "AWS cloud deployment experience is preferred",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "AWS experience preferred",
                confidence: 0.92,
              },
              {
                text: "Docker containerization is a plus",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Docker is a plus",
                confidence: 0.9,
              },
            ],
            skills: [
              {
                name: "JavaScript",
                normalizedName: "JavaScript",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "JavaScript required",
                confidence: 0.98,
              },
              {
                name: "TypeScript",
                normalizedName: "TypeScript",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "TypeScript required",
                confidence: 0.98,
              },
              {
                name: "React",
                normalizedName: "React",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "React required",
                confidence: 0.98,
              },
              {
                name: "Node.js",
                normalizedName: "Node.js",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "Node.js required",
                confidence: 0.98,
              },
              {
                name: "PostgreSQL",
                normalizedName: "PostgreSQL",
                category: "REQUIRED_SKILL",
                importance: "REQUIRED",
                explicit: true,
                evidence: "PostgreSQL experience required",
                confidence: 0.95,
              },
              {
                name: "AWS",
                normalizedName: "AWS",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "AWS experience preferred",
                confidence: 0.92,
              },
              {
                name: "Docker",
                normalizedName: "Docker",
                category: "PREFERRED_SKILL",
                importance: "PREFERRED",
                explicit: true,
                evidence: "Docker is a plus",
                confidence: 0.9,
              },
            ],
            education: [
              {
                degree: "Bachelor's",
                field: "Computer Science",
                minimum: true,
                preferred: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "Bachelor's degree in Computer Science or equivalent",
                confidence: 0.95,
              },
            ],
            certifications: [],
            experience: [
              {
                yearsMin: 5,
                yearsMax: null,
                domain: "software engineering",
                management: false,
                importance: "REQUIRED",
                explicit: true,
                evidence: "5+ years of software engineering experience",
                confidence: 0.95,
              },
            ],
            keywords: [
              {
                keyword: "React",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 4,
                evidence: "React",
                confidence: 0.98,
              },
              {
                keyword: "TypeScript",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 3,
                evidence: "TypeScript",
                confidence: 0.98,
              },
              {
                keyword: "Node.js",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "Node.js",
                confidence: 0.98,
              },
              {
                keyword: "PostgreSQL",
                category: "TECHNICAL",
                importance: "REQUIRED",
                frequency: 2,
                evidence: "PostgreSQL",
                confidence: 0.95,
              },
              {
                keyword: "AWS",
                category: "PLATFORM",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "AWS",
                confidence: 0.92,
              },
              {
                keyword: "Docker",
                category: "TOOL",
                importance: "PREFERRED",
                frequency: 1,
                evidence: "Docker",
                confidence: 0.9,
              },
            ],
            workArrangement: "HYBRID",
            location: "San Francisco, CA",
            industry: "SaaS",
            workAuthorization: null,
            roleSummary:
              "Lead development of full-stack web applications using React, TypeScript, Node.js, and PostgreSQL.",
            requiredSkills: [
              "JavaScript",
              "TypeScript",
              "React",
              "Node.js",
              "PostgreSQL",
            ],
            preferredSkills: ["AWS", "Docker"],
            coreResponsibilities: [
              "Architect scalable backend services and microservices",
              "Develop responsive frontend web applications",
              "Design and maintain relational database schemas",
            ],
            domainKeywords: [
              "React",
              "TypeScript",
              "Node.js",
              "PostgreSQL",
              "AWS",
              "Docker",
            ],
            seniorityLevel: "SENIOR",
            experienceYearsMinimum: 5,
          };
        }
        break;
      }

      case "MatchAnalysisSchema":
        mockData = {
          scoreVersion: "v1",
          overallScore: 88,
          scoreLabel: "Good Match",
          skillMatch: {
            score: 92,
            weight: 35,
            weightedScore: 32.2,
            matchedCount: 5,
            totalCount: 6,
            details: "5 of 6 technical skills matched",
          },
          experienceMatch: {
            score: 85,
            weight: 20,
            weightedScore: 17.0,
            matchedCount: 1,
            totalCount: 1,
            details: "5+ years backend experience verified",
          },
          responsibilityAlignment: {
            score: 85,
            weight: 15,
            weightedScore: 12.75,
            matchedCount: 4,
            totalCount: 5,
            details:
              "Strong alignment with core microservices responsibilities",
          },
          keywordCoverage: {
            score: 80,
            weight: 15,
            weightedScore: 12.0,
            matchedCount: 8,
            totalCount: 10,
            details: "80% coverage of extracted domain keywords",
          },
          educationMatch: {
            score: 100,
            weight: 7.5,
            weightedScore: 7.5,
            matchedCount: 1,
            totalCount: 1,
            details: "Holds required degree",
          },
          certificationMatch: {
            score: 85,
            weight: 7.5,
            weightedScore: 6.38,
            matchedCount: 1,
            totalCount: 1,
            details: "Relevant certifications verified",
          },
          matchedSkills: [
            {
              skill: "TypeScript",
              normalizedSkill: "TypeScript",
              importance: "REQUIRED",
              matchType: "MATCHED",
              resumeEvidence: ["5+ years TypeScript development"],
              confidence: 0.98,
            },
            {
              skill: "PostgreSQL",
              normalizedSkill: "PostgreSQL",
              importance: "REQUIRED",
              matchType: "MATCHED",
              resumeEvidence: ["Designed PostgreSQL relational schemas"],
              confidence: 0.95,
            },
          ],
          missingSkills: [
            {
              skill: "GraphQL",
              normalizedSkill: "GraphQL",
              importance: "PREFERRED",
              matchType: "MISSING",
              resumeEvidence: [],
              confidence: 1.0,
              reason: "Not found in the resume",
            },
          ],
          partialSkills: [],
          matchedRequirements: [],
          missingRequirements: [],
          strengths: [
            {
              title: "Strong Full-Stack TypeScript Background",
              detail:
                "Extensive verified experience in enterprise TypeScript applications.",
              evidence: ["5+ years TypeScript development"],
              category: "TECHNICAL",
            },
          ],
          gaps: [
            {
              title: "GraphQL Experience Not Found",
              detail:
                "GraphQL is a preferred skill but was not found in the resume.",
              importance: "PREFERRED",
              missingType: "SKILL",
              critical: false,
              remedyHint:
                "Consider adding GraphQL experience if used in past projects.",
            },
          ],
          recommendations: [
            {
              title: "Highlight Container & Cloud Deployment",
              description:
                "Highlight cloud deployment and Docker experience in project bullets if applicable.",
              priority: "MEDIUM",
              actionable: true,
            },
          ],
          isStale: false,
          hardSkillsMatchScore: 92,
          experienceMatchScore: 85,
          tailoringRecommendations: [
            "Highlight cloud deployment and Docker experience in project bullets if applicable.",
          ],
        };
        break;

      case "StrategySchema":
        mockData = {
          targetAngle:
            "Full-Stack Technical Lead with robust cloud and TypeScript expertise",
          keywordsToEmphasize: [
            "TypeScript",
            "PostgreSQL",
            "Distributed Systems",
          ],
          sectionsToPrioritize: ["Work Experience", "Core Technical Skills"],
          suggestedFraming: {
            Experience:
              "Focus on business metrics and high-traffic system architecture",
          },
          strategicRecommendations: [
            "Elevate recent Next.js and API architecture bullet points to top",
          ],
        };
        break;

      case "GeneratedContentSchema":
        mockData = {
          tailoredSummary:
            "Results-driven Senior Full-Stack Engineer with 6+ years of experience architecting resilient web applications with Next.js, Node.js, and PostgreSQL.",
          bulletRewrites: [
            {
              originalBullet: "Worked on backend APIs with Node.js",
              rewrittenBullet:
                "Architected high-throughput Fastify microservices handling 2M+ requests/day, cutting p99 latency by 35%",
              keywordsAdded: [
                "Fastify",
                "Microservices",
                "Latency optimization",
              ],
              metricOrImpactAdded: "35% p99 latency reduction",
              evidenceIdRef: "claim-1",
            },
          ],
          suggestedSkillAdditions: ["BullMQ", "Next.js 15"],
          rationale:
            "Framed backend work around quantitative scale and modern tech stack alignment.",
        };
      case "ContentProposalDataSchema": {
        const promptLower = (params.prompt || "").toLowerCase();

        if (
          promptLower.includes("unsupported-tech") ||
          (promptLower.includes("pyspark") &&
            promptLower.includes("test-fixture"))
        ) {
          mockData = {
            changes: [
              {
                id: "change_unsafe_tech_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Developed data processing scripts in Python.",
                proposedValue:
                  "Built scalable big data ETL pipelines using PySpark and Databricks.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_pyspark"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale:
                  "Attempted to add big data technologies absent from resume.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "UNSUPPORTED",
                blockedReason:
                  "Unsupported technology detected: 'pyspark' is not evidenced in the candidate's resume.",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 0,
              blockedCount: 1,
              uncertainCount: 0,
            },
            generalNotes: "Contains unsupported technology claims.",
          };
        } else if (promptLower.includes("invented-metric")) {
          mockData = {
            changes: [
              {
                id: "change_unsafe_metric_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Machine learning model achieved 92% accuracy.",
                proposedValue:
                  "Machine learning model achieved 98% prediction accuracy.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_accuracy"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale: "Inflated model accuracy metric.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "CONTRADICTED",
                blockedReason:
                  "Metric inflation detected: Proposed metric '98%' contradicts original evidence '92%'.",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 0,
              blockedCount: 1,
              uncertainCount: 0,
            },
            generalNotes: "Contains contradicted metric claim.",
          };
        } else if (promptLower.includes("invented-resp")) {
          mockData = {
            changes: [
              {
                id: "change_unsafe_resp_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Assisted with API documentation.",
                proposedValue:
                  "Architected enterprise-scale microservices architecture serving millions of daily active users.",
                changeType: "EXPAND",
                targetRequirementIds: ["req_arch"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale:
                  "Added microservices architecture scope without evidence.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "UNSUPPORTED",
                blockedReason:
                  "Unsupported technology detected: 'microservices' is not evidenced in the candidate's resume.",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 0,
              blockedCount: 1,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("changed-job-title")) {
          mockData = {
            changes: [
              {
                id: "change_unsafe_title_1",
                section: "experience",
                itemId: "exp_1",
                field: "jobTitle",
                originalValue: "Software Developer",
                proposedValue: "Senior Data Scientist",
                changeType: "REWRITE",
                targetRequirementIds: ["req_title"],
                evidenceIds: ["exp_1_title"],
                rationale: "Upgraded job title to match job seniority.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "CONTRADICTED",
                blockedReason:
                  "Seniority title inflation detected: Added 'senior' without underlying role evidence.",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 0,
              blockedCount: 1,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("changed-date")) {
          mockData = {
            changes: [
              {
                id: "change_unsafe_date_1",
                section: "experience",
                itemId: "exp_1",
                field: "startDate",
                originalValue: "Sep 2025",
                proposedValue: "Jan 2024",
                changeType: "REWRITE",
                targetRequirementIds: ["req_exp_years"],
                evidenceIds: ["exp_1_date"],
                rationale: "Extended employment timeline.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "CONTRADICTED",
                blockedReason:
                  "Employment date modification detected: Introduced year(s) '2024' not matching original dates.",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 0,
              blockedCount: 1,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("changed-cert")) {
          mockData = {
            changes: [
              {
                id: "change_unsafe_cert_1",
                section: "certifications",
                itemId: "cert_1",
                field: "name",
                originalValue: "AWS Cloud Practitioner",
                proposedValue: "AWS Solutions Architect Professional",
                changeType: "REWRITE",
                targetRequirementIds: ["req_cert"],
                evidenceIds: [],
                rationale: "Claimed advanced certification without evidence.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "UNSUPPORTED",
                blockedReason:
                  "Missing evidence IDs: Proposed change does not trace to any candidate resume evidence.",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 0,
              blockedCount: 1,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("safe-keyword")) {
          mockData = {
            changes: [
              {
                id: "change_keyword_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Developed RESTful backend services in Node.js.",
                proposedValue:
                  "Developed REST API services in Node.js adhering to standard design patterns.",
                changeType: "KEYWORD_ALIGNMENT",
                targetRequirementIds: ["req_rest_api"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale:
                  "Naturally aligns existing RESTful service phrasing with job description's REST API keywords.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 1,
              blockedCount: 0,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("semantic-rewrite")) {
          mockData = {
            changes: [
              {
                id: "change_semantic_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Worked on RAG-based product applications.",
                proposedValue:
                  "Integrated retrieval-augmented generation capabilities into product applications.",
                changeType: "CLARIFY",
                targetRequirementIds: ["req_rag"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale:
                  "Clarified technical acronym while preserving exact factual scope.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 1,
              blockedCount: 0,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("mixed")) {
          mockData = {
            changes: [
              {
                id: "change_safe_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Developed REST APIs using Node.js.",
                proposedValue:
                  "Developed backend REST APIs using Node.js and Express.js.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_rest_api"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale:
                  "Refined bullet point using candidate's Express.js evidence.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
              },
              {
                id: "change_unsafe_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[1]",
                originalValue: "Optimized database queries in PostgreSQL.",
                proposedValue:
                  "Migrated data architecture to Databricks and Kubernetes clusters.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_cloud"],
                evidenceIds: ["exp_1_bullet_2"],
                rationale: "Attempted to claim unevidenced technologies.",
                risk: "HIGH",
                status: "BLOCKED",
                factCheckStatus: "UNSUPPORTED",
                blockedReason:
                  "Unsupported technology detected: 'databricks' is not evidenced in the candidate's resume.",
              },
            ],
            summaryStats: {
              totalProposed: 2,
              verifiedCount: 1,
              blockedCount: 1,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("long-content")) {
          mockData = {
            changes: [
              {
                id: "change_concise_1",
                section: "summary",
                field: "summary",
                originalValue:
                  "I am a dedicated developer who likes coding and problem solving and working on various backend systems.",
                proposedValue:
                  "Software Developer proficient in Node.js, Python, and SQL with proven experience developing backend APIs and data applications.",
                changeType: "CONDENSE",
                targetRequirementIds: ["req_summary"],
                evidenceIds: ["summary"],
                rationale:
                  "Replaces wordy, generic phrasing with concise, high-impact ATS-friendly summary.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 1,
              blockedCount: 0,
              uncertainCount: 0,
            },
          };
        } else if (promptLower.includes("keyword-stuffing")) {
          mockData = {
            changes: [
              {
                id: "change_natural_keyword_1",
                section: "skills",
                itemId: "skills_1",
                field: "skills[0]",
                originalValue: "Python, SQL",
                proposedValue: "Python, SQL, Machine Learning",
                changeType: "KEYWORD_ALIGNMENT",
                targetRequirementIds: ["req_skills"],
                evidenceIds: ["skills_1"],
                rationale:
                  "Naturally groups evidenced machine learning alongside core Python and SQL.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
              },
            ],
            summaryStats: {
              totalProposed: 1,
              verifiedCount: 1,
              blockedCount: 0,
              uncertainCount: 0,
            },
          };
        } else {
          // Standard / Default Safe Content Proposal (e.g. Data Scientist / Software Developer alignment)
          mockData = {
            changes: [
              {
                id: "change_summary_1",
                section: "summary",
                field: "summary",
                originalValue:
                  "Software Developer | Backend • Full-Stack • AI/ML",
                proposedValue:
                  "Software Developer skilled in backend REST API architecture, machine learning workflows, and relational database systems.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_backend_api"],
                evidenceIds: ["summary"],
                rationale:
                  "Aligns candidate's evidenced backend and ML experience with target role requirements.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
                factCheckReasoning:
                  "All listed skills directly correspond to resume data.",
              },
              {
                id: "change_exp_1_bullet_1",
                section: "experience",
                itemId: "exp_1",
                field: "bullets[0]",
                originalValue: "Developed REST APIs using Node.js.",
                proposedValue:
                  "Developed backend REST APIs using Node.js and Express.js to support application workflows.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_rest_api"],
                evidenceIds: ["exp_1_bullet_1"],
                rationale:
                  "Enhances clarity and professional impact while strictly preserving candidate's proven Express.js stack.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
                factCheckReasoning:
                  "Express.js is evidenced in candidate resume skills.",
              },
              {
                id: "change_proj_1_bullet_1",
                section: "projects",
                itemId: "proj_1",
                field: "bullets[0]",
                originalValue:
                  "Built a movie recommender using Bag of Words and CountVectorizer.",
                proposedValue:
                  "Built a content-based movie recommendation system using Bag of Words, CountVectorizer, and cosine similarity.",
                changeType: "REWRITE",
                targetRequirementIds: ["req_recsys"],
                evidenceIds: ["proj_1_bullet_1"],
                rationale:
                  "Accurately articulates recommendation system architecture using candidate's evidenced algorithms.",
                risk: "LOW",
                status: "PENDING",
                factCheckStatus: "SUPPORTED",
                factCheckReasoning:
                  "All algorithms evidenced in candidate project description.",
              },
            ],
            summaryStats: {
              totalProposed: 3,
              verifiedCount: 3,
              blockedCount: 0,
              uncertainCount: 0,
            },
            generalNotes:
              "All proposed rewrites strictly preserve candidate evidence with zero hallucination.",
            targetJobTitle: "Software Developer",
            targetCompany: "Target Employer",
          };
        }
        break;
      }

      case "FactCheckResultSchema":
        mockData = {
          verified: true,
          claims: [
            {
              id: "claim-1",
              claimText: "Handled backend API development using Node.js",
              claimCategory: "RESPONSIBILITY",
              targetSection: "Experience: Acme Corp",
              status: "SUPPORTED",
              sources: [
                {
                  sourceType: "ORIGINAL_RESUME",
                  sourceIdentifier: "original-resume.pdf",
                  rawSnippet: "Built Node.js APIs for company web platform",
                  confidenceScore: 0.98,
                },
              ],
              verificationNotes:
                "Directly verified from candidate original resume",
            },
          ],
          totalClaimsCount: 1,
          supportedCount: 1,
          unsupportedCount: 0,
          contradictedCount: 0,
          uncertainCount: 0,
          summary:
            "All claims traced to candidate source documents with high confidence.",
        };
        break;

      case "ATSAnalysisSchema":
        mockData = {
          atsScore: 94,
          parseabilityScore: 98,
          keywordMatchPercentage: 90,
          matchedKeywords: ["TypeScript", "Next.js", "PostgreSQL", "API"],
          missingHighValueKeywords: ["Kubernetes"],
          formattingFlags: [],
          recommendations: [
            "Maintain current clean single-column structure for maximum ATS compatibility.",
          ],
        };
        break;

      case "QualityReviewSchema":
        mockData = {
          overallScore: 92,
          approved: true,
          clarityScore: 95,
          impactScore: 90,
          grammaticalFlags: [],
          actionVerbStrength: "STRONG",
          critiqueNotes:
            "Clear, compelling bullet points with measurable impact.",
        };
        break;

      case "ResumeParseResultSchema": {
        const promptText = params.prompt || "";
        const promptLower = promptText.toLowerCase();

        // If it's the standard unit test fixture, preserve the expected John Doe response
        if (
          promptLower.includes("resume of john doe") ||
          promptLower.includes("john-doe-resume") ||
          promptLower.includes("john doe senior software engineer")
        ) {
          mockData = {
            resumeData: {
              personalInfo: {
                fullName: "John Doe",
                headline: "Senior Software Engineer",
                email: "john.doe@email.com",
                phone: "+1 (555) 123-4567",
                location: "San Francisco, CA",
                website: "",
                linkedin: "",
                github: "",
                linkedinUrl: "https://linkedin.com/in/johndoe",
                githubUrl: "https://github.com/johndoe",
                portfolioUrl: "",
              },
              summary:
                "Experienced software engineer with 6+ years building scalable web applications using TypeScript, React, and Node.js.",
              experience: [
                {
                  id: "exp-mock-1",
                  jobTitle: "Senior Software Engineer",
                  position: "Senior Software Engineer",
                  company: "Tech Corp",
                  location: "San Francisco, CA",
                  employmentType: "Full-time",
                  startDate: "Jan 2021",
                  endDate: "",
                  current: true,
                  description: "",
                  bullets: [
                    "Led development of microservices architecture serving 2M+ daily active users",
                    "Reduced API response times by 40% through query optimization and caching",
                    "Mentored team of 4 junior engineers on TypeScript best practices",
                  ],
                  technologiesUsed: [
                    "TypeScript",
                    "React",
                    "Node.js",
                    "PostgreSQL",
                    "Redis",
                  ],
                },
                {
                  id: "exp-mock-2",
                  jobTitle: "Software Engineer",
                  position: "Software Engineer",
                  company: "StartupXYZ",
                  location: "Remote",
                  employmentType: "Full-time",
                  startDate: "Jun 2018",
                  endDate: "Dec 2020",
                  current: false,
                  description: "",
                  bullets: [
                    "Built real-time collaboration features using WebSocket and Redis pub/sub",
                    "Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes",
                  ],
                  technologiesUsed: [
                    "JavaScript",
                    "React",
                    "Express",
                    "MongoDB",
                  ],
                },
              ],
              education: [
                {
                  id: "edu-mock-1",
                  institution: "University of California, Berkeley",
                  degree: "Bachelor of Science",
                  fieldOfStudy: "Computer Science",
                  location: "Berkeley, CA",
                  startDate: "2014",
                  endDate: "2018",
                  current: false,
                  gpa: "3.7",
                  description: "",
                  honors: ["Dean's List"],
                },
              ],
              projects: [],
              skills: [
                {
                  id: "skill-mock-1",
                  category: "Programming Languages",
                  skills: ["TypeScript", "JavaScript", "Python", "Go"],
                },
                {
                  id: "skill-mock-2",
                  category: "Frameworks & Tools",
                  skills: [
                    "React",
                    "Next.js",
                    "Node.js",
                    "Express",
                    "PostgreSQL",
                    "Redis",
                    "Docker",
                  ],
                },
              ],
              certifications: [],
              achievements: [],
              languages: [
                {
                  id: "lang-mock-1",
                  language: "English",
                  proficiency: "Native",
                },
              ],
              links: [],
              sectionVisibility: {
                showSummary: true,
                showExperience: true,
                showEducation: true,
                showProjects: false,
                showSkills: true,
                showCertifications: false,
                showAchievements: false,
                showLanguages: true,
                showLinks: false,
              },
              sectionOrder: [
                "summary",
                "experience",
                "education",
                "skills",
                "projects",
                "certifications",
                "achievements",
                "languages",
                "links",
              ],
            },
            confidence: {
              personalInfo: 0.95,
              summary: 0.9,
              experience: 0.92,
              education: 0.88,
              skills: 0.85,
              projects: 0.0,
              certifications: 0.0,
              achievements: 0.0,
              languages: 0.7,
              links: 0.0,
              overall: 0.82,
            },
            warnings: [
              "No projects section found in resume",
              "No certifications found in resume",
            ],
          };
        } else {
          // Extract raw resume text from prompt (e.g. within <RESUME_TEXT> tags)
          const tagMatch = promptText.match(
            /<RESUME_TEXT>([\s\S]*?)<\/RESUME_TEXT>/i,
          );
          const rawResume = tagMatch ? tagMatch[1] : promptText;
          mockData = parseResumeFromText(rawResume);
        }
        break;
      }

      case "ResumeStrategySchema": {
        let resumeData: any = {};
        let jobAnalysis: any = {};
        let matchAnalysis: any = {};
        let context: any = {};

        try {
          const resMatch = (params.prompt || "").match(
            /<RESUME_DATA>([\s\S]*?)<\/RESUME_DATA>/,
          );
          if (resMatch) resumeData = JSON.parse(resMatch[1]);
        } catch {}

        try {
          const jobMatch = (params.prompt || "").match(
            /<JOB_ANALYSIS>([\s\S]*?)<\/JOB_ANALYSIS>/,
          );
          if (jobMatch) jobAnalysis = JSON.parse(jobMatch[1]);
        } catch {}

        try {
          const matchMatch = (params.prompt || "").match(
            /<MATCH_ANALYSIS>([\s\S]*?)<\/MATCH_ANALYSIS>/,
          );
          if (matchMatch) matchAnalysis = JSON.parse(matchMatch[1]);
        } catch {}

        try {
          const ctxMatch = (params.prompt || "").match(
            /<CONTEXT>([\s\S]*?)<\/CONTEXT>/,
          );
          if (ctxMatch) context = JSON.parse(ctxMatch[1]);
        } catch {}

        const resumeId =
          context.resumeId || "00000000-0000-0000-0000-000000000001";
        const jobId = context.jobId || "00000000-0000-0000-0000-000000000002";
        const matchId = context.matchId || null;

        // Extract experience items from actual resumeData
        const experiences = Array.isArray(resumeData.experience)
          ? resumeData.experience
          : [];
        const experienceItems = experiences.map((exp: any, idx: number) => ({
          experienceId: exp.id || `exp-${idx + 1}`,
          company: exp.company || "Company",
          jobTitle: exp.jobTitle || exp.position || "Role",
          priority: Math.min(idx + 1, 5),
          actions: [
            "EMPHASIZE_RELEVANT_RESPONSIBILITIES",
            "EMPHASIZE_RELEVANT_TECHNOLOGIES",
          ],
          reason: `Emphasize key responsibilities and technical accomplishments achieved at ${exp.company || "past position"}.`,
          evidence:
            exp.technologiesUsed || (exp.bullets ? [exp.bullets[0]] : []),
        }));

        // Extract project items from actual resumeData
        const projects = Array.isArray(resumeData.projects)
          ? resumeData.projects
          : [];
        const projectItems = projects.map((proj: any, idx: number) => ({
          projectId: proj.id || `proj-${idx + 1}`,
          projectName: proj.title || proj.name || "Project",
          priority: Math.min(idx + 1, 5),
          action: "EMPHASIZE",
          reason: `Highlights hands-on technical delivery in ${proj.title || proj.name || "project"}.`,
          evidence: proj.technologiesUsed || [],
        }));

        // Extract skills
        const resumeSkillsList: string[] = [];
        if (Array.isArray(resumeData.skills)) {
          for (const s of resumeData.skills) {
            if (Array.isArray(s.skills)) resumeSkillsList.push(...s.skills);
            else if (typeof s === "string") resumeSkillsList.push(s);
          }
        }
        const lowerResumeSkills = new Set(
          resumeSkillsList.map((s) => s.toLowerCase().trim()),
        );

        // Extract job skills
        const jobSkills = Array.isArray(jobAnalysis.skills)
          ? jobAnalysis.skills
          : [];
        const matchedSkills: string[] = [];
        const missingSkills: string[] = [];

        for (const js of jobSkills) {
          const sName =
            typeof js === "string" ? js : js.name || js.normalizedName;
          if (!sName) continue;
          if (lowerResumeSkills.has(sName.toLowerCase().trim())) {
            matchedSkills.push(sName);
          } else {
            missingSkills.push(sName);
          }
        }

        // If no skills found in jobAnalysis, provide standard defaults
        if (matchedSkills.length === 0 && resumeSkillsList.length > 0) {
          matchedSkills.push(...resumeSkillsList.slice(0, 4));
        }
        if (missingSkills.length === 0) {
          missingSkills.push("Kubernetes", "AWS");
        }

        mockData = {
          resumeId,
          jobId,
          matchId,
          strategyVersion: RESUME_STRATEGY_VERSION,
          status: "DRAFT",
          overview: {
            objective: "Tailor resume for target role",
            overallApproach:
              "Strategic alignment emphasizing verified full-stack architecture, backend optimization, and distributed systems capabilities matching target role priorities while maintaining factual integrity.",
            prioritySummary:
              "Emphasize core experience and verified skills; strictly do not claim missing cloud technologies.",
          },
          overallApproach:
            "Strategic alignment emphasizing verified full-stack architecture, backend optimization, and distributed systems capabilities matching target role priorities while maintaining factual integrity.",
          sectionStrategies: [
            {
              section: "experience",
              action: "EMPHASIZE",
              priority: 1,
              reason:
                "Core employment history demonstrates high alignment with target engineering responsibilities.",
              evidence: experienceItems
                .map((e: any) => e.company)
                .filter(Boolean),
              confidence: 0.95,
            },
            {
              section: "skills",
              action: "EMPHASIZE",
              priority: 1,
              reason:
                "Direct skill alignment with primary technical stack requirements.",
              evidence: matchedSkills.slice(0, 5),
              confidence: 0.95,
            },
            {
              section: "projects",
              action: projectItems.length > 0 ? "EMPHASIZE" : "OMIT_IF_EMPTY",
              priority: 2,
              reason:
                "Demonstrates practical execution and software engineering delivery.",
              evidence: projectItems
                .map((p: any) => p.projectName)
                .filter(Boolean),
              confidence: 0.9,
            },
            {
              section: "summary",
              action: "MAINTAIN",
              priority: 2,
              reason:
                "Frames overall career trajectory and primary value proposition.",
              evidence: [],
              confidence: 0.9,
            },
            {
              section: "education",
              action: "MAINTAIN",
              priority: 3,
              reason: "Standard educational credential verification.",
              evidence: [],
              confidence: 0.95,
            },
            {
              section: "certifications",
              action: "CONDENSE",
              priority: 4,
              reason: "Supplementary credentials to keep resume compact.",
              evidence: [],
              confidence: 0.85,
            },
            {
              section: "languages",
              action: "OPTIONAL",
              priority: 5,
              reason: "Supplementary personal information.",
              evidence: [],
              confidence: 0.85,
            },
          ],
          skillStrategy: {
            emphasize: matchedSkills.map((s) => ({
              skill: s,
              source: "both",
              reason: `Direct requirement alignment: candidate demonstrates verifiable proficiency in ${s}.`,
              evidence: [s],
            })),
            maintain: resumeSkillsList
              .filter((s) => !matchedSkills.includes(s))
              .slice(0, 5)
              .map((s) => ({
                skill: s,
                source: "resume",
                reason:
                  "Foundational candidate competency supporting technical breadth.",
                evidence: [s],
              })),
            deemphasize: [],
            missing: missingSkills.map((s) => ({
              skill: s,
              reason: "Not evidenced in current resume.",
              action: "DO_NOT_CLAIM",
              advisoryNote: `Consider highlighting ${s} only if candidate possesses genuine verifiable experience.`,
            })),
          },
          keywordStrategy: {
            keywords: [
              ...matchedSkills.map((s) => ({
                keyword: s,
                classification: "SAFE_TO_SURFACE",
                resumeEvidence: [s],
                jobEvidence: [s],
                reason:
                  "Verified in candidate resume and requested by target job posting.",
              })),
              ...missingSkills.map((s) => ({
                keyword: s,
                classification: "MISSING_DO_NOT_ADD",
                resumeEvidence: [],
                jobEvidence: [s],
                reason:
                  "Not evidenced in candidate resume. Strictly do not claim or fabricate.",
              })),
            ],
            mustNaturallyInclude: matchedSkills.slice(0, 3).map((s) => ({
              keyword: s,
              requirementId: `req-${s.toLowerCase()}`,
              evidenceIds: [s],
              reason: `Naturally incorporate ${s} across relevant project and experience bullet points.`,
            })),
            alreadyCovered: matchedSkills.map((s) => ({
              keyword: s,
              evidenceIds: [s],
            })),
            missingAndUnsafe: missingSkills.map((s) => ({
              keyword: s,
              requirementId: `req-${s.toLowerCase()}`,
              reason: `Candidate has no verified experience in ${s}. Do not invent or add without evidence.`,
            })),
          },
          experienceStrategy: {
            items: experienceItems,
          },
          projectStrategy: {
            items: projectItems,
          },
          gapStrategy: {
            gaps: missingSkills.map((s) => ({
              requirement: s,
              classification: "MISSING_REQUIRED",
              recommendation: "DO_NOT_CLAIM",
              reason: "Not evidenced in current resume.",
              advisoryTip: `Do not claim ${s} unless candidate has authentic hands-on experience. Highlight related fundamentals instead.`,
            })),
          },
          requirementStrategy: [
            ...matchedSkills.map((s) => ({
              requirementId: `req-${s.toLowerCase()}`,
              status: "MATCHED",
              strategy: "EMPHASIZE_EXISTING_EVIDENCE",
              evidenceIds: [s],
              reason: `Candidate demonstrates verified background in ${s}. Emphasize in primary bullets.`,
              priority: "HIGH",
            })),
            ...missingSkills.map((s) => ({
              requirementId: `req-${s.toLowerCase()}`,
              status: "MISSING",
              strategy: "DO_NOT_INVENT",
              evidenceIds: [],
              reason: `No evidence for ${s} found in candidate resume. Strictly preserve truthfulness.`,
              priority: "HIGH",
            })),
          ],
          riskFlags: [
            ...missingSkills.map((s) => ({
              type: "MISSING_EVIDENCE",
              description: `Target role emphasizes ${s}, but candidate resume contains no supporting evidence. DO NOT CLAIM.`,
              evidenceIds: [],
              severity: "HIGH",
            })),
          ],
          protectedFacts: [
            ...experienceItems.map((e: any) => ({
              field: "employmentHistory",
              value: `${e.jobTitle} at ${e.company}`,
              evidenceIds: [e.experienceId],
              reason:
                "Authentic employer and position title must be strictly preserved.",
            })),
          ],
          preservationRules: DEFAULT_PRESERVATION_RULES,
          prohibitedChanges: DEFAULT_PROHIBITED_CHANGES,
          evidence: [
            {
              strategyItemId: "strat-ev-1",
              sourceType: "RESUME",
              sourceId: resumeId,
              excerpt:
                "Candidate technical experience aligns with target engineering stack.",
              relationship: "SUPPORTS",
              confidence: 0.95,
            },
          ],
          confidence: 0.95,
          isStale: false,
          generatedAt: new Date().toISOString(),
        };
        break;
      }

      case "SectionRegenerationOutputSchema": {
        const promptLower = (params.prompt || "").toLowerCase();

        if (promptLower.includes("test-1-python")) {
          mockData = {
            proposedValue:
              "Engineered scalable backend solutions and data processing pipelines using Python.",
            rationale: "Align with candidate's evidenced Python skills",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-2-django") ||
          promptLower.includes("try django")
        ) {
          mockData = {
            proposedValue:
              "Engineered scalable web applications and REST APIs using Python and Django.",
            rationale: "Align with web framework stack",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-3-microservices") ||
          promptLower.includes("try microservices")
        ) {
          mockData = {
            proposedValue:
              "Architected and deployed scalable microservices to support mission-critical workflows.",
            rationale: "Highlight architectural impact",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-4-kubernetes") ||
          promptLower.includes("try kubernetes")
        ) {
          mockData = {
            proposedValue:
              "Containerized core microservices using Docker and orchestrated deployments on Kubernetes clusters.",
            rationale: "Highlight container orchestration",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-5-databricks") ||
          promptLower.includes("try databricks") ||
          promptLower.includes('user custom instruction ===\n"add databricks"')
        ) {
          mockData = {
            proposedValue:
              "Engineered large-scale data transformation workflows using Databricks and Python.",
            rationale: "Align with target job Databricks requirement",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-6-metric-preserve") ||
          promptLower.includes("preserve 92%")
        ) {
          mockData = {
            proposedValue:
              "Engineered machine learning models achieving 92% accuracy on validation datasets.",
            rationale: "Highlight evidenced model accuracy",
            evidenceIds: ["exp_1_b2"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-7-metric-inflate") ||
          promptLower.includes("97%")
        ) {
          mockData = {
            proposedValue:
              "Engineered machine learning models achieving 97% accuracy on validation datasets.",
            rationale: "Inflated model accuracy",
            evidenceIds: ["exp_1_b2"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-8-dates") ||
          promptLower.includes("date-alteration") ||
          promptLower.includes("date changes")
        ) {
          mockData = {
            proposedValue: "Jan 2019 – Present",
            rationale: "Extend employment timeframe",
            evidenceIds: ["exp_1_dates"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-9-title") ||
          promptLower.includes("title-inflation") ||
          promptLower.includes("title upgrade")
        ) {
          mockData = {
            proposedValue: "Senior Software Engineer & Lead Architect",
            rationale: "Elevate seniority title",
            evidenceIds: ["exp_1_title"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-10-long-summary") ||
          promptLower.includes("150-word")
        ) {
          // Exactly ~150 words summary
          mockData = {
            proposedValue:
              "Experienced and results-driven Software Developer with a robust background in building reliable backend systems, web applications, and predictive machine learning models using Python, Node.js, and modern relational databases. Proven track record of developing performant REST APIs, optimizing backend query structures, and designing end-to-end recommendation algorithms that improve candidate and user satisfaction across diverse platforms. Adept at applying software design patterns, structured error handling, automated testing principles, and clean modular code standards across distributed development teams. Passionate about tackling complex algorithmic challenges, translating business logic into maintainable technical implementations, and collaborating closely with cross-functional stakeholders including product managers, UI engineers, and data analysts to deliver high-quality digital solutions. Committed to continuous technical improvement, agile development methodologies, rapid prototyping, and delivering measurable engineering outcomes that align with company goals and modern industry architecture best practices in scalable web development.",
            rationale: "Overly verbose summary for length testing",
            evidenceIds: ["summary_evidence"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-40-semantic-unit") ||
          promptLower.includes("10k+ users")
        ) {
          mockData = {
            proposedValue:
              "Scaled platform to 10K+ users daily through automated data pipelines.",
            rationale: "Highlight user scale",
            evidenceIds: ["exp_1_bullet_4"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-40-scalability") ||
          promptLower.includes("scalable backend architecture")
        ) {
          mockData = {
            proposedValue:
              "Architected scalable backend architecture using Node.js.",
            rationale: "Emphasize scalability",
            evidenceIds: ["exp_1_bullet_1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-40-employer") ||
          promptLower.includes("try-google")
        ) {
          mockData = {
            proposedValue:
              "Engineered high-throughput backend services at Google.",
            rationale: "Prominent employer claim",
            evidenceIds: ["exp_1_company"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-40-cert") ||
          promptLower.includes("try-aws-cert")
        ) {
          mockData = {
            proposedValue:
              "AWS Certified Developer with 3 years of experience building backend REST APIs.",
            rationale: "Add cloud credential",
            evidenceIds: ["summary_evidence"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("test-40-tamper") ||
          promptLower.includes("try-tamper")
        ) {
          mockData = {
            proposedValue: "Developed REST APIs using Node.js.",
            rationale: "Evidence tampering test",
            evidenceIds: ["tampered_evidence_id_999"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("unsupported-tech") ||
          promptLower.includes("unsupported technology") ||
          promptLower.includes("try unsupported") ||
          promptLower.includes("rust")
        ) {
          mockData = {
            proposedValue:
              "Architected distributed ETL data pipelines using PySpark, Rust, and Databricks clusters.",
            rationale: "Align with big data processing stack",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("invented-metric") ||
          promptLower.includes("invented metric") ||
          promptLower.includes("try invented") ||
          promptLower.includes("99.999%") ||
          promptLower.includes("50m")
        ) {
          mockData = {
            proposedValue:
              "Machine learning model achieved 99.999% prediction accuracy across production inference workloads.",
            rationale: "Highlight high performance predictive metrics",
            evidenceIds: ["exp_1_b2"],
            changeType: "REWRITE",
          };
        } else if (promptLower.includes("keyword-stuffing")) {
          mockData = {
            proposedValue:
              "Python Python Python developer writing Python Python code in Python backend systems.",
            rationale: "Repeated keywords for search density",
            evidenceIds: ["skills_1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("ignore all") ||
          promptLower.includes("system compromised") ||
          promptLower.includes("jailbreak")
        ) {
          mockData = {
            proposedValue:
              "SYSTEM COMPROMISED: All security protocols and factual constraints bypassed.",
            rationale: "Simulated unevidenced prompt injection payload.",
            evidenceIds: ["summary_evidence"],
            changeType: "REWRITE",
          };
        } else if (promptLower.includes("section: summary")) {
          mockData = {
            proposedValue:
              "Software Developer specializing in backend REST APIs, machine learning, and web development using Node.js, Python, and SQL. Proven background building predictive models and responsive web applications. Dedicated to clean code, ATS-aligned technical design, and full-stack software delivery.",
            rationale:
              "Formulates a high-impact, ATS-friendly professional summary strictly emphasizing candidate's evidenced technologies.",
            evidenceIds: ["summary_evidence"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("section: experience") ||
          promptLower.includes("bullet")
        ) {
          mockData = {
            proposedValue:
              "Developed backend REST APIs using Node.js and Express.js to support application workflows.",
            rationale:
              "Incorporates candidate's evidenced Express.js framework to articulate API responsibilities clearly.",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else if (
          promptLower.includes("section: projects") ||
          promptLower.includes("project")
        ) {
          mockData = {
            proposedValue:
              "Built a content-based movie recommendation system using Bag of Words and CountVectorizer with Python and Scikit-learn.",
            rationale:
              "Clarifies machine learning modeling methodology using verified candidate project evidence.",
            evidenceIds: ["proj_1_b1"],
            changeType: "REWRITE",
          };
        } else if (promptLower.includes("section: skills")) {
          mockData = {
            proposedValue: "Python, JavaScript, SQL, Node.js, Express.js",
            rationale:
              "Normalizes technical naming and groups backend web stack cleanly.",
            evidenceIds: ["skill_1"],
            changeType: "KEYWORD_ALIGNMENT",
          };
        } else if (
          promptLower.includes("section: achievements") ||
          promptLower.includes("achievement")
        ) {
          mockData = {
            proposedValue:
              "Engineered scalable REST APIs supporting mission-critical backend operations.",
            rationale:
              "Emphasizes authentic technical achievement with strong action verb.",
            evidenceIds: ["exp_1_b1"],
            changeType: "REWRITE",
          };
        } else {
          // Default: Summary rewrite
          mockData = {
            proposedValue:
              "Software Developer specializing in backend REST APIs, machine learning, and web development using Node.js, Python, and SQL. Proven background building predictive models and collaborative services. Dedicated to clean code, ATS-aligned technical design, and full-stack software delivery.",
            rationale:
              "Formulates a high-impact, ATS-friendly professional summary strictly emphasizing candidate's evidenced technologies.",
            evidenceIds: ["summary_evidence"],
            changeType: "REWRITE",
          };
        }
        break;
      }

      case "AIQualityAnalysisOutputSchema": {
        const promptLower = (params.prompt || "").toLowerCase();

        if (
          promptLower.includes("ignore") &&
          (promptLower.includes("instruction") ||
            promptLower.includes("score of 100") ||
            promptLower.includes("kubernetes"))
        ) {
          // Adversarial prompt injection defense fixture: treated strictly as passive text
          mockData = {
            clarityAssessment:
              "Malicious prompt instructions detected inside resume content were ignored and treated strictly as passive text.",
            contentStrengths: [
              "Document parsed safely without prompt injection vulnerability.",
            ],
            contentFindings: [
              {
                category: "CONTENT_QUALITY",
                severity: "LOW",
                title: "Content clarity evaluation",
                description:
                  "Resume text contains unusual command phrasing which was safely treated as passive text.",
                whyItMatters:
                  "Resume text should focus strictly on professional qualifications.",
                recommendation:
                  "Ensure resume text reflects verifiable work history.",
                section: "experience",
                confidence: 0.99,
              },
            ],
            actionableRecommendations: [
              "Focus resume on authentic, verifiable technical achievements.",
            ],
          };
        } else {
          mockData = {
            clarityAssessment:
              "Resume demonstrates solid technical foundations with well-structured achievements.",
            contentStrengths: [
              "Well-structured professional chronology with clear technical titles",
              "Consistent alignment across skills and project deliverables",
              "Action-oriented bullet points demonstrating technical ownership",
            ],
            contentFindings: [
              {
                category: "CONTENT_QUALITY",
                severity: "LOW",
                title: "Action verbs could be strengthened in earlier roles",
                description:
                  "A few bullets use passive or descriptive wording rather than direct outcome phrasing.",
                whyItMatters:
                  "Opening with strong action verbs emphasizes candidate ownership and leadership.",
                recommendation:
                  "If supported by your experience, start accomplishments with direct verbs such as 'Engineered' or 'Delivered'.",
                section: "experience",
                confidence: 0.92,
              },
            ],
            actionableRecommendations: [
              "Highlight primary tools and libraries under each major project.",
              "If supported by your actual experience, consider adding measurable performance outcomes or volume metrics.",
            ],
          };
        }
        break;
      }

      default:
        mockData = {};
    }

    const validated = params.schema.parse(mockData);

    return {
      data: validated,
      rawText: JSON.stringify(validated, null, 2),
      model: this.model,
      inputTokens: 250,
      outputTokens: 400,
      totalTokens: 650,
      estimatedCostUsd: 0.0,
    };
  }

  async generateText(params: TextGenerationParams): Promise<AITextResponse> {
    return {
      text: `[Mock AI Response for: "${params.prompt.substring(0, 50)}..."]`,
      model: this.model,
      inputTokens: 100,
      outputTokens: 150,
      totalTokens: 250,
      estimatedCostUsd: 0.0,
    };
  }
}
