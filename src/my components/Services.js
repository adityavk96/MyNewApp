import React from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

const Services = () => {
  const servicesList = [
    { name: "GSTR Reco 2A OR 2B", icon: FileText, link: "/gst-reco" },
     { name: "GSTR Reco 2A OR 2B", icon: FileText, link: "/gst-reco" },
      { name: "GSTR Reco 2A OR 2B", icon: FileText, link: "/gst-reco" },
  ];

  return (
    <main className="flex flex-col items-center w-full p-6 pt-12 min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
      <h1 className="text-4xl font-bold text-white">Our Services</h1>

      <p className="text-lg text-center text-white/90 mt-4 mb-10">
        We offer a range of professional services tailored to your needs.
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6 max-w-5xl w-full">
        {servicesList.map((service, index) => {
          const Icon = service.icon;
          return (
            <Link
              to={service.link}
              key={index}
              className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-transform duration-300 max-w-sm"
            >
              <Icon className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">{service.name}</h3>
            </Link>
          );
        })}
      </div>
    </main>
  );
};

export default Services;
