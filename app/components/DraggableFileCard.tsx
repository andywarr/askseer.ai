"use client";

import Image from "next/image";

import React from "react";
import { useDrag, useDrop } from "react-dnd";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Radio,
  Typography,
} from "@/MTailwind";

const ItemType = "CARD";

interface FileType {
  name: string;
  size: number;
  type: string;
}

interface DraggableCardProps {
  file: FileType;
  index: number;
  moveCard: (fromIndex: number, toIndex: number) => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  file,
  index,
  moveCard,
}) => {
  const ref = React.useRef(null);

  const [, drop] = useDrop({
    accept: ItemType,
    hover(item: { index: number }) {
      if (item.index !== index) {
        moveCard(item.index, index);
        item.index = index;
      }
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <Card key={index} className="flex flex-row">
        {/* <CardHeader
          shadow={false}
          floated={false}
          className="m-0 w-2/5 shrink-0 rounded-r-none"
        >
          <Image
            src={URL.createObjectURL(file)}
            alt={file.name}
            fill
            className="h-full w-full object-cover object-left"
          />
        </CardHeader> */}
        <CardBody className="flex w-full flex-row p-2">
          <div>
            <Typography variant="paragraph">{file.name}</Typography>
            <Typography variant="small" className="text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          </div>
          <Button
            className="ml-auto h-fit w-fit p-2"
            ripple={false}
            variant="text"
            // onClick={() => handleDeleteButtonClick(index)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                fillRule="evenodd"
                d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z"
                clipRule="evenodd"
              ></path>
            </svg>
          </Button>
        </CardBody>
      </Card>
    </div>
  );
};

export default DraggableCard;
