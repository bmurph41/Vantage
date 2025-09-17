import { cn } from "@/lib/utils";
import { Shield, AlertTriangle, FileText, Scale } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface DisclaimersProps {
  data: OfferingMemorandum;
  className?: string;
}

export function Disclaimers({ data, className }: DisclaimersProps) {
  const { disclaimers, riskFactors, brokerCompany, brokerLicense, listingAgents } = data;
  
  // Standard legal disclaimers that are always included
  const standardDisclaimers = [
    {
      title: "Information Accuracy",
      content: "The information contained in this Offering Memorandum has been obtained from sources believed reliable. However, neither the Owner nor the Broker makes any representation or warranty, express or implied, as to the accuracy or completeness of the information contained herein."
    },
    {
      title: "Independent Verification",
      content: "Prospective purchasers should conduct their own investigation and analysis of the property and verify all information contained herein. This offering is subject to errors, omissions, changes in price, terms, or withdrawal without notice."
    },
    {
      title: "No Offering or Solicitation",
      content: "This Offering Memorandum does not constitute an offer to sell or a solicitation of an offer to buy. The property is offered subject to prior sale, change in price or terms, or withdrawal from the market without notice."
    },
    {
      title: "Professional Advice",
      content: "Recipients should consult their own legal, tax, and financial advisors regarding the purchase of this property. The Broker is not qualified to provide legal, tax, or other professional advice."
    }
  ];
  
  return (
    <ReportSection
      title="Disclaimers & Risk Factors"
      index={8}
      className={cn("space-y-8", className)}
      data-testid="disclaimers-section"
    >
      {/* Important Notice */}
      <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-2">
              Important Legal Notice
            </h4>
            <p className="text-amber-800 text-sm leading-relaxed">
              Please review all disclaimers and risk factors carefully before making any 
              investment decision. This information is provided for qualified investors 
              and should not be construed as investment advice. Past performance does not 
              guarantee future results.
            </p>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {riskFactors && riskFactors.length > 0 && (
        <div className="space-y-6">
          <div className="border-b border-neutral-200 pb-4">
            <h4 className="font-semibold text-neutral-900 text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              Investment Risk Factors
            </h4>
            <p className="text-sm text-neutral-600 mt-1">
              The following risks should be carefully considered before making an investment decision
            </p>
          </div>

          <div className="bg-red-50 rounded-lg p-6 border border-red-200">
            <div className="space-y-4">
              {riskFactors.map((risk, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-semibold mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-red-800 text-sm leading-relaxed">
                    {risk}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legal Disclaimers */}
      <div className="space-y-6">
        <div className="border-b border-neutral-200 pb-4">
          <h4 className="font-semibold text-neutral-900 text-lg flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-600" />
            Legal Disclaimers
          </h4>
          <p className="text-sm text-neutral-600 mt-1">
            Standard legal disclaimers and limitations of liability
          </p>
        </div>

        <div className="grid gap-6">
          {standardDisclaimers.map((disclaimer, index) => (
            <div key={index} className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              <h5 className="font-semibold text-neutral-900 mb-3">
                {disclaimer.title}
              </h5>
              <p className="text-neutral-700 text-sm leading-relaxed">
                {disclaimer.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Disclaimers */}
      {disclaimers && (
        <div className="space-y-6">
          <div className="border-b border-neutral-200 pb-4">
            <h4 className="font-semibold text-neutral-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Additional Disclaimers
            </h4>
          </div>

          <div className="prose prose-neutral max-w-none">
            {disclaimers.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-neutral-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Broker Information */}
      <ReportTwoCol leftWidth="2/3" gap="lg" alignTop>
        <div className="space-y-6">
          {/* Licensing Information */}
          <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
            <h5 className="font-semibold text-emerald-900 mb-4">
              Broker Licensing Information
            </h5>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-emerald-700 font-medium mb-1">Brokerage Company:</dt>
                <dd className="text-emerald-900">{brokerCompany}</dd>
              </div>
              {brokerLicense && (
                <div>
                  <dt className="text-emerald-700 font-medium mb-1">License Number:</dt>
                  <dd className="text-emerald-900 font-mono">{brokerLicense}</dd>
                </div>
              )}
              <div>
                <dt className="text-emerald-700 font-medium mb-1">Report Date:</dt>
                <dd className="text-emerald-900">
                  {new Date(data.dateCreated).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </dd>
              </div>
              {data.lastUpdated !== data.dateCreated && (
                <div>
                  <dt className="text-emerald-700 font-medium mb-1">Last Updated:</dt>
                  <dd className="text-emerald-900">
                    {new Date(data.lastUpdated).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Confidentiality Notice */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h5 className="font-semibold text-blue-900 mb-3">
              Confidentiality Agreement
            </h5>
            <p className="text-blue-800 text-sm leading-relaxed">
              This Offering Memorandum contains confidential and proprietary information. 
              By accepting this document, the recipient agrees to keep all information 
              confidential and not to disclose any information to third parties without 
              the prior written consent of the Owner and Broker. The recipient further 
              agrees to return this document upon request.
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-6">
          {listingAgents && listingAgents.length > 0 && (
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              <h5 className="font-semibold text-neutral-900 mb-4">
                Legal Questions & Contact
              </h5>
              <p className="text-neutral-600 text-sm mb-4">
                For questions regarding this offering or legal disclaimers, contact:
              </p>
              <div className="space-y-4">
                {listingAgents.map((agent, index) => (
                  <div key={index} className="text-sm">
                    <div className="font-medium text-neutral-900">
                      {agent.name}
                    </div>
                    <div className="text-neutral-600">
                      {agent.title}
                    </div>
                    <div className="text-neutral-600">
                      {agent.company}
                    </div>
                    <div className="text-neutral-600">
                      {agent.phone}
                    </div>
                    <div className="text-neutral-600">
                      {agent.email}
                    </div>
                    {agent.license && (
                      <div className="text-neutral-600 font-mono text-xs">
                        License: {agent.license}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copyright Notice */}
          <div className="bg-neutral-100 rounded-lg p-4 border border-neutral-200">
            <p className="text-neutral-600 text-xs leading-relaxed">
              © {new Date().getFullYear()} {brokerCompany}. All rights reserved. 
              This document and its contents are protected by copyright and other 
              intellectual property laws. No part of this publication may be reproduced, 
              distributed, or transmitted without the prior written permission of the publisher.
            </p>
          </div>
        </div>
      </ReportTwoCol>

      {/* Final Legal Notice */}
      <div className="bg-neutral-900 text-neutral-100 rounded-lg p-6">
        <p className="text-sm leading-relaxed text-center">
          <strong>IMPORTANT:</strong> This Offering Memorandum is intended solely for the use of 
          prospective qualified purchasers in considering the purchase of the described property. 
          Distribution of this document to anyone other than prospective qualified purchasers 
          and their advisors is unauthorized. Any reproduction of this document, in whole or in part, 
          or the divulgence of any of its contents without the prior written consent of 
          {brokerCompany} is prohibited.
        </p>
      </div>
    </ReportSection>
  );
}

export default Disclaimers;