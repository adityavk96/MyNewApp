import React from "react";
import { Link } from "react-router-dom";
import {  FileText } from "lucide-react";

const Services = () => {
  const servicesList = [
    { name: "GSTR Reco 2A OR 2B", icon: FileText, link: "/gst-reco" },
    { name: "GSTR Reco", icon: FileText, link: "/gst-reco" },
    { name: "GST Filing", icon: FileText, link: "/gst-filing" },
    /* { name: "Web Development", icon: Code, link: "/web-development" },
    { name: "Mobile App Development", icon: Smartphone, link: "/mobile-app-development" },
    { name: "UI/UX Design", icon: Palette, link: "/ui-ux-design" },*/
  ];

  return (
    <main className="flex flex-col items-center w-full p-6 pt-12 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800">Our Services</h1>

      <p className="text-lg text-center text-gray-600 mt-4 mb-10">
        We offer a range of professional services tailored to your needs.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
        {servicesList.map((service, index) => {
          const Icon = service.icon;
          return (
            <Link
              to={service.link}
              key={index}
              className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-transform duration-300"
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
