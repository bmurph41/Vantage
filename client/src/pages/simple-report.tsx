import SimpleReportGenerator from "@/components/om-builder/SimpleReportGenerator";

export default function SimpleReportPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <SimpleReportGenerator />
      </div>
    </div>
  );
}
